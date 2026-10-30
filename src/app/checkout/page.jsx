import connectDB from "@/lib/db";
import Product from "@/models/Product";
import { toPlainText } from "@/lib/serialize";
import CheckoutClient from "./CheckoutClient";

/**
 * CHECKOUT PAGE — server wrapper.
 *
 * Reads ?product=<id> from the URL, loads the product from MongoDB,
 * and hands it to the client component that renders the order summary.
 *
 * PAYMENT PLACEHOLDER: the confirm step here is a stub. When you're ready
 * to take real money, wire Stripe / Razorpay / crypto inside CheckoutClient
 * (see the "TODO: PAYMENT INTEGRATION" comment there).
 */
export const dynamic = "force-dynamic";

export const metadata = { title: "Checkout" };

export default async function CheckoutPage({ searchParams }) {
  const productId = searchParams?.product || "";
  let product = null;

  if (productId && /^[a-f\d]{24}$/i.test(productId)) {
    try {
      await connectDB();
      const doc = await Product.findById(productId).lean();
      if (doc) product = toPlainText(doc);
    } catch (err) {
      console.error("Checkout lookup failed:", err?.message || err);
    }
  }

  return <CheckoutClient product={product} />;
}
