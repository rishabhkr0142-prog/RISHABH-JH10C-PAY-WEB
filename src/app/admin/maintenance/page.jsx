import connectDB from "@/lib/db";
import Category from "@/models/Category";
import Product from "@/models/Product";
import MaintenanceLog from "@/models/MaintenanceLog";
import { toPlainText } from "@/lib/serialize";
import MaintenanceManager from "./MaintenanceManager";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export const metadata = {
  title: "Maintenance Mode | Admin Panel",
};

export default async function AdminMaintenancePage() {
  await connectDB();

  const [categoriesRaw, distinctCategories, productsRaw, logsRaw] = await Promise.all([
    Category.find().sort({ name: 1 }).lean(),
    Product.distinct("category"),
    Product.find()
      .select(
        "name slug category price images imageUrl stock stockMode plans isOutOfStock maintenance maintenanceReason"
      )
      .sort({ name: 1 })
      .lean(),
    MaintenanceLog.find().sort({ createdAt: -1 }).limit(50).lean(),
  ]);

  // Merge categories: Category collection + any distinct category on existing products
  const categoryMap = new Map();
  for (const cat of categoriesRaw) {
    if (cat.name) {
      categoryMap.set(String(cat.name).trim().toLowerCase(), {
        _id: String(cat._id),
        name: cat.name,
        maintenance: Boolean(cat.maintenance),
        maintenanceReason: cat.maintenanceReason || "",
        maintenanceUntil: cat.maintenanceUntil || "",
        maintenanceSince: cat.maintenanceSince || null,
      });
    }
  }

  for (const catName of distinctCategories) {
    if (catName && typeof catName === "string") {
      const normalized = catName.trim().toLowerCase();
      if (!categoryMap.has(normalized)) {
        categoryMap.set(normalized, {
          _id: "",
          name: catName.trim(),
          maintenance: false,
          maintenanceReason: "",
          maintenanceUntil: "",
          maintenanceSince: null,
        });
      }
    }
  }

  // Ensure default "General" category exists if nothing else
  if (categoryMap.size === 0) {
    categoryMap.set("general", {
      _id: "",
      name: "General",
      maintenance: false,
      maintenanceReason: "",
      maintenanceUntil: "",
      maintenanceSince: null,
    });
  }

  const categories = Array.from(categoryMap.values()).sort((a, b) =>
    a.name.localeCompare(b.name)
  );

  return (
    <MaintenanceManager
      initialCategories={toPlainText(categories)}
      initialProducts={toPlainText(productsRaw)}
      initialLogs={toPlainText(logsRaw)}
    />
  );
}

