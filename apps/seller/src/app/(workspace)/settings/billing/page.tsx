import type { Metadata } from "next";

import { BillingSettingsView } from "@/components/settings/billingSettingsView";

export const metadata: Metadata = { title: "Plan and billing" };

export default function BillingSettingsPage() {
  return <BillingSettingsView />;
}
