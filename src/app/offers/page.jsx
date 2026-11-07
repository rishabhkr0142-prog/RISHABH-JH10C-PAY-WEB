import { getLiveOffers } from "@/lib/offers";
import OffersClient from "./OffersClient";

// Short cache for fast responses; admin mutations trigger revalidatePath("/offers")
export const revalidate = 30;

export const metadata = {
  title: "Offers",
  description:
    "Grab exclusive limited-time deals, special discounts, and verified coupon codes on RISHABH JH10C PAY WEB digital products.",
  openGraph: {
    title: "Offers | RISHABH JH10C PAY WEB",
    description:
      "Grab exclusive limited-time deals, special discounts, and verified coupon codes.",
  },
};

export default async function OffersPage() {
  const offers = await getLiveOffers();

  return <OffersClient initialOffers={offers} />;
}

