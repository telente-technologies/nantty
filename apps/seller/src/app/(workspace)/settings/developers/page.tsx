import type { Metadata } from "next";

import { DeveloperSettingsView } from "@/components/settings/developerSettingsView";

export const metadata: Metadata = { title: "API keys & webhooks" };

export default function DeveloperSettingsPage() {
  return <DeveloperSettingsView />;
}
