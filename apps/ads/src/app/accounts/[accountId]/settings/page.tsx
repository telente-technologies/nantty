import type { Metadata } from "next";

import { SettingsPage } from "@/components/settings/settingsPage";

export const metadata: Metadata = { title: "Settings & people" };

export default function Page() {
  return <SettingsPage />;
}
