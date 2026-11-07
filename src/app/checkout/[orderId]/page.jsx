import { notFound, redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import connectDB from "@/lib/db";
import Order from "@/models/Order";
import { findUserForSession } from "@/lib/account";
import { toPlainText } from "@/lib/serialize";
import { isOrderOwner, redactOrderLicense } from "@/lib/order-access";
import { releaseProductStockReservation } from "@/lib/product-stock";
import { generateQrCode } from "@/lib/qr";
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

  // Read UPI Gateway configuration on server ONLY (never expose secrets)
  const upiId =
    process.env.FAMPAY_UPI_ID || process.env.UPI_ID || "rishabh04@fam";
  const upiName = process.env.UPI_NAME || "RISHABH JH10C PAY";
  const orderPaise =
    order.amountPaise || Math.round((Number(order.price) || 0) * 100);
  const formattedAmount = (orderPaise / 100).toFixed(2);

  // Exact UPI parameters (URL-encoded)
  const queryParams = new URLSearchParams({
    pa: upiId,
    pn: upiName,
    am: formattedAmount,
    cu: "INR",
    tn: String(order._id),
    tr: String(order._id),
  }).toString();

  // App-specific and generic URI schemes
  const upiLinks = {
    generic: `upi://pay?${queryParams}`,
    phonepe: {
      intent: `intent://upi/pay?${queryParams}#Intent;scheme=upi;package=com.phonepe.app;end`,
      ios: `phonepe://pay?${queryParams}`,
    },
    gpay: {
      intent: `intent://upi/pay?${queryParams}#Intent;scheme=upi;package=com.google.android.apps.nbu.paisa.user;end`,
      ios: `tez://upi/pay?${queryParams}`,
    },
    paytm: {
      intent: `intent://pay?${queryParams}#Intent;scheme=upi;package=net.one97.paytm;end`,
      ios: `paytmmp://pay?${queryParams}`,
    },
  };

  // Generate high-resolution clean QR code image on the server (no center logo overlay)
  let qrCodeDataUrl = "";
  if (order.status === "pending") {
    qrCodeDataUrl = await generateQrCode(upiLinks.generic, { size: 600 });
  }

  const serializedOrder = redactOrderLicense(
    toPlainText(order),
    session,
    userDocLean
  );

  return (
    <CheckoutClient
      initialOrder={serializedOrder}
      qrCodeDataUrl={qrCodeDataUrl}
      upiLink={upiLinks.generic}
      upiLinks={upiLinks}
      upiId={upiId}
      upiName={upiName}
      formattedAmount={formattedAmount}
    />
  );
}
