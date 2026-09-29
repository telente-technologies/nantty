import type { Metadata } from "next";

import { BillingSettingsView } from "@/components/settings/billingSettingsView";

export const metadata: Metadata = { title: "Billing and Gold plan" };

export default function BillingSettingsPage() {
  return <BillingSettingsView />;
}
