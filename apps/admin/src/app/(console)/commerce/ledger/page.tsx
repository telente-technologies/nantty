import type { Metadata } from "next";

import { LedgerWorkspace } from "@/components/money/ledgerWorkspace";

export const metadata: Metadata = { title: "Ledger" };

export default function LedgerPage() {
  return <LedgerWorkspace />;
}
