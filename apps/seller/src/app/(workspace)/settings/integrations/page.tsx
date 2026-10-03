import type { Metadata } from "next";

import { IntegrationsSettingsView } from "@/components/settings/integrationsSettingsView";

export const metadata: Metadata = { title: "Integrations" };

export default function IntegrationsSettingsPage() {
  return <IntegrationsSettingsView />;
}
