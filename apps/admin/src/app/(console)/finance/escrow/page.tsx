import type { Metadata } from "next";

import { FinanceEscrowWorkspace } from "@/components/finance/financeEscrowWorkspace";

export const metadata: Metadata = { title: "Escrow health" };

export default function FinanceEscrowPage() {
  return <FinanceEscrowWorkspace />;
}
