import type { Metadata } from "next";

import { LoyaltySettingsView } from "@/components/settings/loyaltySettingsForm";

export const metadata: Metadata = { title: "Loyalty" };

export default function LoyaltySettingsPage() {
  return <LoyaltySettingsView />;
}
