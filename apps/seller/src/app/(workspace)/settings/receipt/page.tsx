import type { Metadata } from "next";

import { ReceiptSettingsView } from "@/components/settings/receiptSettingsForm";

export const metadata: Metadata = { title: "Receipt" };

export default function ReceiptSettingsPage() {
  return <ReceiptSettingsView />;
}
