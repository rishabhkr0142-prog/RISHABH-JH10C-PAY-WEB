import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import crypto from "crypto";
import connectDB from "@/lib/db";
import Payment from "@/models/Payment";
import Order from "@/models/Order";
import Client from "@/models/Client";
import { markOrderBuyerAsClient } from "@/lib/account";
import { completeOrder } from "@/lib/fulfillment";
import { ensureStockForPayment } from "@/lib/product-stock";

export const dynamic = "force-dynamic";

/**
 * Validates HMAC-SHA256 signature using constant-time comparison.
 */
function verifyHmacSignature(rawBody, headerSignature, secret) {
  if (!headerSignature || !secret) return false;

  const cleanHeader = String(headerSignature).trim().toLowerCase();
  const normalizedProvided = cleanHeader.startsWith("sha256=")
    ? cleanHeader.slice(7)
    : cleanHeader;

  // Header must be a valid 64-character hex string (SHA256)
  if (!/^[a-f0-9]{64}$/.test(normalizedProvided)) {
    return false;
  }

  const computedHex = crypto
    .createHmac("sha256", secret)
    .update(rawBody, "utf8")
    .digest("hex")
    .toLowerCase();

  const providedBuffer = Buffer.from(normalizedProvided, "hex");
  const computedBuffer = Buffer.from(computedHex, "hex");

  if (providedBuffer.length !== computedBuffer.length) {
    return false;
  }

  return crypto.timingSafeEqual(providedBuffer, computedBuffer);
}

/**
 * POST /api/pay/webhook
 * Receives incoming UPI credit notifications (e.g. from Google Apps Script listening to FamPay emails).
 */
export async function POST(request) {
  try {
    const rawBody = await request.text();
    const signature =
      request.headers.get("x-signature") ||
      request.headers.get("X-Signature") ||
      request.headers.get("x-hub-signature-256");

    const webhookSecret = process.env.WEBHOOK_SECRET;

    if (!webhookSecret) {
      console.error("WEBHOOK_SECRET is not configured on the server.");
      return NextResponse.json(
        { error: "Webhook endpoint not configured" },
        { status: 500 }
      );
    }

    // 1. Signature Check (Constant-time HMAC verification)
    if (!verifyHmacSignature(rawBody, signature, webhookSecret)) {
      return NextResponse.json(
        { error: "Invalid or missing HMAC signature" },
        { status: 401 }
      );
    }

    // 2. Parse and Validate Body
    let body;
    try {
      body = JSON.parse(rawBody);
    } catch {
      return NextResponse.json(
        { error: "Malformed JSON payload" },
        { status: 400 }
      );
    }

    const { amountPaise, utr, txnId = "", payerUpi = "", paidAt } = body || {};

    // Validate UTR: digits only, minimum length 6, typical length 12
    const cleanUtr = String(utr || "").trim().replace(/[\s-]/g, "");
    if (!/^\d{6,20}$/.test(cleanUtr)) {
      return NextResponse.json(
        { error: "Invalid UTR format. Must be numeric digits only." },
        { status: 400 }
      );
    }

    // Validate amountPaise: positive integer
    const parsedAmountPaise = Number(amountPaise);
    if (
      !Number.isInteger(parsedAmountPaise) ||
      parsedAmountPaise <= 0
    ) {
      return NextResponse.json(
        { error: "Invalid amountPaise. Must be a positive integer in paise." },
        { status: 400 }
      );
    }

    // Parse transaction date
    let paymentDate = paidAt ? new Date(paidAt) : new Date();
    if (isNaN(paymentDate.getTime())) {
      paymentDate = new Date();
    }

    await connectDB();

    // 3. Insert Payment as 'unclaimed' (Idempotent duplicate check)
    let paymentDoc;
    let isDuplicate = false;

    try {
      paymentDoc = await Payment.create({
        utr: cleanUtr,
        txnId: String(txnId || "").trim(),
        amountPaise: parsedAmountPaise,
        payerUpi: String(payerUpi || "").trim(),
        paidAt: paymentDate,
        status: "unclaimed",
        receivedAt: new Date(),
      });
    } catch (err) {
      // Only a true E11000 duplicate-key error on unique `utr` is idempotent.
      if (err?.code === 11000) {
        isDuplicate = true;
        paymentDoc = await Payment.findOne({ utr: cleanUtr });
      } else {
        throw err;
      }
    }

    // If payment already exists and is already claimed, return 200 idempotently
    if (isDuplicate) {
      return NextResponse.json({
        ok: true,
        duplicate: true,
        message: "Payment with this UTR has already been recorded.",
        matched: paymentDoc?.status === "claimed",
        paymentId: paymentDoc?._id,
      });
    }

    // 4. Auto-Match Logic
    // Find pending/recently-expired order matching:
    // - status in ['pending', 'expired']
    // - amountPaise == payment.amountPaise
    // - createdAt <= payment.paidAt (with 30-second leeway for clock skew) <= expiresAt
    const paymentTime = paymentDate.getTime();
    const candidateOrders = await Order.find({
      status: { $in: ["pending", "expired"] },
      amountPaise: parsedAmountPaise,
      createdAt: { $lte: new Date(paymentTime + 30000) },
      expiresAt: { $gte: new Date(paymentTime - 30000) },
    }).sort({ createdAt: -1 });

    let matched = false;
    let matchedOrderId = null;

    if (candidateOrders.length === 1) {
      const targetOrder = candidateOrders[0];

      // Reserve/confirm inventory before accepting the payment. If the unit
      // was released after expiry and none is left, leave the payment for
      // manual admin review instead of overselling.
      const stockCheck = await ensureStockForPayment(targetOrder);
      if (!stockCheck.ok) {
        return NextResponse.json({
          ok: true,
          matched: false,
          outOfStock: true,
          orderId: String(targetOrder._id),
          paymentId: paymentDoc._id,
          message:
            "Matching order found but inventory could not be reserved. Payment left unclaimed for admin review.",
        });
      }

      // Atomically claim the payment
      const claimedPayment = await Payment.findOneAndUpdate(
        { _id: paymentDoc._id, status: "unclaimed" },
        {
          $set: {
            status: "claimed",
            orderId: targetOrder._id,
          },
        },
        { new: true }
      );

      if (claimedPayment) {
        // Atomically transition the order to 'paid'
        const updatedOrder = await Order.findOneAndUpdate(
          { _id: targetOrder._id, status: { $in: ["pending", "expired"] } },
          {
            $set: {
              status: "paid",
              paidAt: paymentDate,
              utr: cleanUtr,
              paymentId: paymentDoc._id,
            },
          },
          { new: true }
        );

        if (updatedOrder) {
          matched = true;
          matchedOrderId = String(targetOrder._id);

          // Update user client status & metrics
          try {
            await markOrderBuyerAsClient(updatedOrder);
          } catch (statErr) {
            console.error("Metric update error after payment match:", statErr);
          }

          // Automatic license delivery (idempotent, one key per order).
          try {
            await completeOrder(updatedOrder._id);
          } catch (fulfillmentErr) {
            console.error(
              "License fulfillment failed after webhook match:",
              fulfillmentErr?.message || fulfillmentErr
            );
          }

          revalidatePath(`/checkout/${targetOrder._id}`);
          revalidatePath("/dashboard");
          revalidatePath("/admin/orders");
          revalidatePath("/admin");
        } else {
          // Rollback payment claim if order was not pending
          await Payment.findByIdAndUpdate(paymentDoc._id, {
            $set: { status: "unclaimed", orderId: null },
          });
        }
      }
    }

    // If 0 matches or >1 ambiguous matches, payment remains 'unclaimed' for buyer or admin to claim
    return NextResponse.json({
      ok: true,
      matched,
      orderId: matchedOrderId,
      paymentId: paymentDoc._id,
      matchesFound: candidateOrders.length,
    });
  } catch (err) {
    console.error("POST /api/pay/webhook failed:", err);
    return NextResponse.json(
      { error: "Webhook processing error" },
      { status: 500 }
    );
  }
}
