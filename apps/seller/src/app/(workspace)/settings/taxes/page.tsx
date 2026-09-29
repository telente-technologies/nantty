import type { Metadata } from "next";

import { TaxSettingsView } from "@/components/settings/taxSettingsForm";

export const metadata: Metadata = { title: "Taxes" };

export default function TaxSettingsPage() {
  return <TaxSettingsView />;
}
