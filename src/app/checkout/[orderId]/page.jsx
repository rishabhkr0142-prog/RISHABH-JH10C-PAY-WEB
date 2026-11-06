import { notFound, redirect } from "next/navigation";
import QRCode from "qrcode";
import { getSession } from "@/lib/session";
import connectDB from "@/lib/db";
import Order from "@/models/Order";
import { findUserForSession } from "@/lib/account";
import { toPlainText } from "@/lib/serialize";
import { isOrderOwner, redactOrderLicense } from "@/lib/order-access";
import { releaseProductStockReservation } from "@/lib/product-stock";
import CheckoutClient from "./CheckoutClient";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function generateMetadata({ params }) {
  return {
    title: `Checkout #${String(params?.orderId || "").slice(-6)}`,
  };
}

export default async function OrderCheckoutPage({ params }) {
  const session = await getSession();
  const orderId = params?.orderId;

  if (!session?.user?.id) {
    redirect(`/login?callbackUrl=/checkout/${orderId}`);
  }

  if (!orderId || !/^[a-f\d]{24}$/i.test(orderId)) {
    notFound();
  }

  await connectDB();
  const userDoc = await findUserForSession(session);
  const userDocLean = userDoc?.toObject ? userDoc.toObject() : userDoc;

  let order = await Order.findById(orderId).populate("product").lean();
  if (!order) {
    notFound();
  }

  const isOwner = isOrderOwner(order, session, userDocLean);

  const isAdmin = Boolean(session.user.isAdmin);

  if (!isOwner && !isAdmin) {
    redirect("/dashboard");
  }

  // Server-side auto-expiration check (atomic condition, no read-then-write).
  const now = new Date();
  if (
    order.status === "pending" &&
    order.expiresAt &&
    new Date(order.expiresAt) <= now
  ) {
    const expired = await Order.findOneAndUpdate(
      {
        _id: order._id,
        status: "pending",
        expiresAt: { $lte: now },
      },
      { $set: { status: "expired" } },
      { new: true }
    ).lean();

    if (expired) {
      order.status = "expired";
      await releaseProductStockReservation(expired, "order_expired");
    }
  } else if (order.status === "cancelled") {
    await releaseProductStockReservation(order, "order_cancelled");
  }

  // Read UPI Gateway configuration on server ONLY
  const upiId = process.env.FAMPAY_UPI_ID || process.env.UPI_ID || "rishabh04@fam";
  const upiName = process.env.UPI_NAME || "RISHABH JH10C PAY";
  const orderPaise = order.amountPaise || Math.round((Number(order.price) || 0) * 100);
  const formattedAmount = (orderPaise / 100).toFixed(2);

  // Generate UPI Payment URI
  // Format: upi://pay?pa=FAMPAY_UPI_ID&pn=RISHABH JH10C PAY&am=AMOUNT&cu=INR&tn=ORDER_ID
  const upiLink = `upi://pay?pa=${encodeURIComponent(upiId)}&pn=${encodeURIComponent(upiName)}&am=${formattedAmount}&cu=INR&tn=${encodeURIComponent(String(order._id))}`;

  // Generate Base64 QR code image on the server using qrcode (no external API)
  let qrCodeDataUrl = "";
  if (order.status === "pending") {
    try {
      qrCodeDataUrl = await QRCode.toDataURL(upiLink, {
        width: 320,
        margin: 2,
        color: {
          dark: "#000000",
          light: "#ffffff",
        },
      });
    } catch (qrErr) {
      console.error("Failed to generate QR code:", qrErr);
    }
  }

  const serializedOrder = redactOrderLicense(toPlainText(order), session, userDocLean);

  return (
    <CheckoutClient
      initialOrder={serializedOrder}
      qrCodeDataUrl={qrCodeDataUrl}
      upiLink={upiLink}
      upiId={upiId}
    />
  );
}

