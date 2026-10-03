import type { Metadata } from "next";

import { SecuritySettingsView } from "@/components/settings/securitySettingsView";

export const metadata: Metadata = { title: "Security" };

export default function SecuritySettingsPage() {
  return <SecuritySettingsView />;
}
