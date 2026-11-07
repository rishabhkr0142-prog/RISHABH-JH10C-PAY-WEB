import { calculateDiscount } from "@/lib/offer-utils";
import { normalizeDeliveryType } from "@/lib/delivery-content";

/**
 * Pure reseller helpers shared by server and client components.
 * Do not import mongoose here.
 */

export const RESELLER_ORDER_TYPE = "reseller_membership";
export const RESELLER_PRICE = 149;
export const RESELLER_PRICE_PAISE = 14900;
export const RESELLER_DISCOUNT_PERCENT = 50;
export const RESELLER_PRODUCT_NAME = "Reseller Membership";

/** License App products are the only products that get the reseller discount. */
export function isLicenseProduct(product) {
  return normalizeDeliveryType(product?.deliveryType) === "license";
}

function toPrice(value) {
  return Math.max(0, Math.round((Number(value) || 0) * 100) / 100);
}

/** Flat 50% discount amount for a price. */
export function resellerDiscountAmount(price) {
  const base = toPrice(price);
  if (base <= 0) return 0;
  return Math.round(((base * RESELLER_DISCOUNT_PERCENT) / 100) * 100) / 100;
}

/** Price after the reseller discount. */
export function resellerPrice(price) {
  const base = toPrice(price);
  if (base <= 0) return 0;
  return toPrice(base - resellerDiscountAmount(base));
}

export function isResellerEligible(product, isReseller) {
  return Boolean(isReseller) && isLicenseProduct(product);
}

/**
 * Resolve the reseller discount for a single price. The discount is only
 * granted to active resellers buying a license product.
 */
export function resolveResellerDiscount({ price, product, isReseller }) {
  const base = toPrice(price);
  if (!isResellerEligible(product, isReseller) || base <= 0) {
    return {
      eligible: false,
      discount: 0,
      percent: 0,
      finalPrice: base,
    };
  }

  const discount = resellerDiscountAmount(base);
  return {
    eligible: true,
    discount,
    percent: RESELLER_DISCOUNT_PERCENT,
    finalPrice: toPrice(base - discount),
  };
}

/**
 * Pick the single best discount. Reseller and coupon discounts never stack;
 * the larger one wins and the reseller discount wins ties.
 */
export function chooseBestDiscount({
  basePrice,
  couponOffer,
  isReseller,
  product,
}) {
  const base = toPrice(basePrice);
  const couponDiscount = couponOffer ? calculateDiscount(base, couponOffer) : 0;
  const reseller = resolveResellerDiscount({
    price: base,
    product,
    isReseller,
  });

  const useReseller = reseller.discount > 0 && reseller.discount >= couponDiscount;
  const discount = Math.max(couponDiscount, reseller.discount);

  return {
    basePrice: base,
    couponDiscount,
    resellerDiscount: reseller.discount,
    resellerPercent: reseller.percent,
    resellerEligible: reseller.eligible,
    useReseller,
    discount,
    finalPrice: toPrice(base - discount),
    discountSource: discount <= 0 ? "none" : useReseller ? "reseller" : "coupon",
  };
}
