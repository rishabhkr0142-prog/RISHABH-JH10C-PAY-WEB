import connectDB from "@/lib/db";
import Client from "@/models/Client";
import { toPlainText } from "@/lib/serialize";
import AdminPagination from "@/components/AdminPagination";
import ClientsManager from "./ClientsManager";

/**
 * ADMIN /admin/clients — paying customers (managed manually until checkout
 * goes live). Add new clients with the modal, remove ones you got wrong.
 */
export const dynamic = "force-dynamic";

const PAGE_SIZE = 100;

export default async function AdminClientsPage({ searchParams }) {
  await connectDB();

  const requested = Number(searchParams?.page);
  const page = Number.isFinite(requested) && requested >= 1 ? Math.floor(requested) : 1;
  const total = await Client.countDocuments().catch(() => 0);
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);

  const clients = await Client.find()
    .select("name email discordId totalSpent notes createdAt updatedAt")
    .sort({ createdAt: -1 })
    .skip((safePage - 1) * PAGE_SIZE)
    .limit(PAGE_SIZE)
    .lean();

  return (
    <div className="space-y-4">
      <ClientsManager clients={toPlainText(clients)} />
      <AdminPagination
        basePath="/admin/clients"
        page={safePage}
        totalPages={totalPages}
        total={total}
        label="clients"
      />
    </div>
  );
}
