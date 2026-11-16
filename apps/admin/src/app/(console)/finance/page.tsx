import type { Metadata } from "next";

import { FinanceOverviewWorkspace } from "@/components/finance/financeOverviewWorkspace";

export const metadata: Metadata = { title: "Finance overview" };

export default function FinanceOverviewPage() {
  return <FinanceOverviewWorkspace />;
}
