import connectDB from "@/lib/db";
import Client from "@/models/Client";
import { toPlainText } from "@/lib/serialize";
import ClientsManager from "./ClientsManager";

/**
 * ADMIN /admin/clients — paying customers (managed manually until checkout
 * goes live). Add new clients with the modal, remove ones you got wrong.
 */
export const dynamic = "force-dynamic";

export default async function AdminClientsPage() {
  await connectDB();
  const clients = toPlainText(await Client.find().sort({ createdAt: -1 }).lean());

  return <ClientsManager clients={clients} />;
}
