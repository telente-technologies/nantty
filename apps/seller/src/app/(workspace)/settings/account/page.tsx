import type { Metadata } from "next";

import { AccountSettingsView } from "@/components/settings/accountSettingsView";

export const metadata: Metadata = { title: "Account" };

export default function AccountSettingsPage() {
  return <AccountSettingsView />;
}
