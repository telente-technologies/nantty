import type { Metadata } from "next";

import { FinanceFeesView } from "@/components/wallet/financeFeesView";

export const metadata: Metadata = { title: "Fees" };

export default function FeesPage() {
  return <FinanceFeesView />;
}
