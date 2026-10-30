import { getAllSettings } from "@/lib/settings";
import SettingsManager from "./SettingsManager";

export const dynamic = "force-dynamic";

export const metadata = { title: "Store Settings | Admin" };

export default async function AdminSettingsPage() {
  const settings = await getAllSettings();
  return <SettingsManager initialSettings={settings} />;
}

