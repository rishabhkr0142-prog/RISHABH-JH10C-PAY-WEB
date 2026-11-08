import { getLiveOffers } from "@/lib/offers";
import OffersClient from "./OffersClient";
import { buildPageMetadata } from "@/lib/site";

// Short cache for fast responses; admin mutations trigger revalidatePath("/offers")
export const revalidate = 30;

export const metadata = buildPageMetadata({
  title: "Current Offers & Coupons",
  description:
    "See current coupons, limited-time discounts, and live offers on digital products. Apply a code at checkout before it expires.",
  path: "/offers",
});

export default async function OffersPage() {
  const offers = await getLiveOffers();

  return <OffersClient initialOffers={offers} />;
}

