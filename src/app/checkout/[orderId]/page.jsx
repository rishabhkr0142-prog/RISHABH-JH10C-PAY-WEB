import { notFound, redirect } from "next/navigation";
import QRCode from "qrcode";
import { getSession } from "@/lib/session";
import connectDB from "@/lib/db";
import Order from "@/models/Order";
import User from "@/models/User";
import { toPlainText } from "@/lib/serialize";
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
  const userDoc = await User.findOne({ discordId: session.user.id }).lean();

  let order = await Order.findById(orderId).populate("product").lean();
  if (!order) {
    notFound();
  }

  const isOwner =
    order.discordId === session.user.id ||
    (userDoc?._id && String(order.user) === String(userDoc._id)) ||
    (session.user.email && order.email === session.user.email);

  const isAdmin = Boolean(session.user.isAdmin);

  if (!isOwner && !isAdmin) {
    redirect("/dashboard");
  }

  // Server-side auto-expiration check
  const now = new Date();
  if (order.status === "pending" && order.expiresAt && new Date(order.expiresAt) <= now) {
    await Order.findByIdAndUpdate(orderId, { status: "expired" });
    order.status = "expired";
  }

  // Read UPI Gateway configuration on server ONLY
  const upiId = process.env.UPI_ID || "rishabhjh10c@okaxis";
  const upiName = process.env.UPI_NAME || "RISHABH JH10C PAY";
  const amountNumber = Number(order.price || order.amount || 0);
  const formattedAmount = amountNumber.toFixed(2);

  // Generate UPI Payment URI
  // Format: upi://pay?pa=UPI_ID&pn=UPI_NAME&am=AMOUNT&cu=INR&tn=ORDER_ID
  const upiLink = `upi://pay?pa=${encodeURIComponent(upiId)}&pn=${encodeURIComponent(upiName)}&am=${formattedAmount}&cu=INR&tn=${encodeURIComponent(String(order._id))}`;

  // Generate Base64 QR code image on the server
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

  const serializedOrder = toPlainText(order);

  return (
    <CheckoutClient
      initialOrder={serializedOrder}
      qrCodeDataUrl={qrCodeDataUrl}
      upiLink={upiLink}
      upiIdMasked={upiId.replace(/(?<=.).(?=.*@)/g, "*")}
    />
  );
}

