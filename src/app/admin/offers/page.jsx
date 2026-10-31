import { getAllOffers } from "@/lib/offers";
import connectDB from "@/lib/db";
import Product from "@/models/Product";
import { toPlainText } from "@/lib/serialize";
import OffersManager from "./OffersManager";

/**
 * ADMIN /admin/offers — create / edit / pause / delete time-limited offers.
 * Only admins can manage offers, including after they expire.
 */
export const dynamic = "force-dynamic";
export const revalidate = 0;

export const metadata = { title: "Offers | Admin" };

export default async function AdminOffersPage() {
  await connectDB();
  const [offers, products] = await Promise.all([
    getAllOffers(),
    Product.find().select("name slug").sort({ name: 1 }).lean().then(toPlainText),
  ]);

  return <OffersManager offers={offers} products={products} />;
}
