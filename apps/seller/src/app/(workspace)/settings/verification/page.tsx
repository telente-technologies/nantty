import type { Metadata } from "next";

import { VerificationSettingsView } from "@/components/settings/verificationSettingsView";

export const metadata: Metadata = { title: "Verification" };

export default function VerificationSettingsPage() {
  return <VerificationSettingsView />;
}
