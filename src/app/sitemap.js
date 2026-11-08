import connectDB from "@/lib/db";
import Product from "@/models/Product";
import { SITE_URL } from "@/lib/site";

export const revalidate = 3600;

const PUBLIC_PAGES = [
  { path: "/", priority: 1, changeFrequency: "weekly" },
  { path: "/products", priority: 0.9, changeFrequency: "daily" },
  { path: "/offers", priority: 0.8, changeFrequency: "daily" },
  { path: "/reseller", priority: 0.8, changeFrequency: "weekly" },
  { path: "/support", priority: 0.6, changeFrequency: "monthly" },
  { path: "/privacy", priority: 0.3, changeFrequency: "yearly" },
  { path: "/terms", priority: 0.3, changeFrequency: "yearly" },
  { path: "/refund", priority: 0.3, changeFrequency: "yearly" },
];

export default async function sitemap() {
  const now = new Date();

  const staticEntries = PUBLIC_PAGES.map((page) => ({
    url: `${SITE_URL}${page.path === "/" ? "" : page.path}`,
    lastModified: now,
    changeFrequency: page.changeFrequency,
    priority: page.priority,
  }));

  let productEntries = [];

  try {
    await connectDB();
    const products = await Product.find({
      $or: [
        { active: true },
        { available: true },
        { active: { $exists: false } },
      ],
    })
      .select("slug updatedAt")
      .sort({ updatedAt: -1 })
      .limit(5000)
      .lean();

    productEntries = products
      .map((product) => String(product.slug || "").trim())
      .filter(Boolean)
      .map((slug) => ({
        url: `${SITE_URL}/products/${encodeURIComponent(slug)}`,
        lastModified: now,
        changeFrequency: "weekly",
        priority: 0.7,
      }));
  } catch (err) {
    console.error("Sitemap product fetch failed:", err?.message || err);
  }

  return [...staticEntries, ...productEntries];
}
