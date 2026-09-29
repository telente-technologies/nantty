import type { Metadata } from "next";

import { StoreProfileSettingsView } from "@/components/settings/storeProfileSettingsForm";

export const metadata: Metadata = { title: "Store profile" };

export default function StoreProfileSettingsPage() {
  return <StoreProfileSettingsView />;
}
