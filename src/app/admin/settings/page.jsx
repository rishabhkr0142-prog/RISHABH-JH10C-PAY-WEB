import { getSafeAdminSettings } from "@/lib/settings";
import SettingsManager from "./SettingsManager";

export const dynamic = "force-dynamic";

export const metadata = { title: "Store Settings | Admin" };

export default async function AdminSettingsPage() {
  const settings = await getSafeAdminSettings();
  return <SettingsManager initialSettings={settings} />;
}
