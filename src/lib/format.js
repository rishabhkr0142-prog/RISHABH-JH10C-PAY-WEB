/**
 * Small formatting helpers shared by pages.
 */

/** Format a product price with the site currency (₹ by default, see .env.example). */
export function formatPrice(price) {
  const currency =
    process.env.NEXT_PUBLIC_CURRENCY || "₹";
  const n = Number(price) || 0;
  return `${currency}${n.toLocaleString("en-IN", {
    minimumFractionDigits: n % 1 === 0 ? 0 : 2,
    maximumFractionDigits: 2,
  })}`;
}

/** "just now" / "5m ago" / "3d ago" — used in admin tables. */
export function timeAgo(date) {
  if (!date) return "—";
  const seconds = Math.floor((Date.now() - new Date(date).getTime()) / 1000);
  if (seconds < 60) return "just now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;
  return new Date(date).toLocaleDateString();
}
