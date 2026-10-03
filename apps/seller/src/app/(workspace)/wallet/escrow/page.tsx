import type { Metadata } from "next";

import { EscrowTransactionsView } from "@/components/wallet/escrowTransactionsView";

export const metadata: Metadata = { title: "Escrow" };

export default function EscrowPage() {
  return <EscrowTransactionsView />;
}
