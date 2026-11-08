/**
 * Single source of truth for public site URL and shared SEO metadata.
 *
 * Change NEXT_PUBLIC_SITE_URL when the domain changes — sitemap, robots,
 * canonicals and Open Graph URLs all follow automatically.
 */

export const SITE_NAME = "RISHABH JH10C PAY WEB";

const FALLBACK_SITE_URL = "https://rishabh-jh10c-pay-web.vercel.app";

function normalizeSiteUrl(value) {
  const raw = String(value || "").trim() || FALLBACK_SITE_URL;
  try {
    return new URL(raw).origin;
  } catch {
    return FALLBACK_SITE_URL;
  }
}

export const SITE_URL = normalizeSiteUrl(process.env.NEXT_PUBLIC_SITE_URL);

export const DEFAULT_DESCRIPTION =
  "Premium digital products with automated delivery after UPI payment, order tracking in your dashboard, and Discord support.";

export const DEFAULT_OG_IMAGE = `${SITE_URL}/og-default.png`;
export const DEFAULT_OG_IMAGE_ALT =
  "RISHABH JH10C PAY WEB - Premium Digital Products & License Keys";

export function absoluteUrl(path = "/") {
  if (/^https?:\/\//i.test(path)) return path;
  return `${SITE_URL}${path.startsWith("/") ? path : `/${path}`}`;
}

/**
 * Build page metadata with a consistent title suffix, canonical URL and
 * Open Graph / Twitter card fields.
 */
export function buildPageMetadata({
  title,
  description = DEFAULT_DESCRIPTION,
  path = "/",
  image = DEFAULT_OG_IMAGE,
  imageAlt = DEFAULT_OG_IMAGE_ALT,
  type = "website",
  robots,
}) {
  const safeTitle = String(title || SITE_NAME).trim();
  const fullTitle = safeTitle.includes(SITE_NAME)
    ? safeTitle
    : `${safeTitle} | ${SITE_NAME}`;
  const imageUrl = /^https?:\/\//i.test(image) ? image : absoluteUrl(image);

  const imageEntry = { url: imageUrl, alt: imageAlt };
  if (imageUrl === DEFAULT_OG_IMAGE) {
    imageEntry.width = 1200;
    imageEntry.height = 630;
  }

  return {
    title: safeTitle,
    description,
    alternates: { canonical: path },
    openGraph: {
      title: fullTitle,
      description,
      url: absoluteUrl(path),
      siteName: SITE_NAME,
      locale: "en_US",
      type,
      images: [imageEntry],
    },
    twitter: {
      card: "summary_large_image",
      title: fullTitle,
      description,
      images: [{ url: imageUrl, alt: imageAlt }],
    },
    ...(robots ? { robots } : {}),
  };
}
