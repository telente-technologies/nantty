import type { Metadata } from "next";

import { FinanceRefundsView } from "@/components/wallet/financeRefundsView";

export const metadata: Metadata = { title: "Refunds" };

export default function RefundsPage() {
  return <FinanceRefundsView />;
}
