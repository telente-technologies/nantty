import type { Metadata } from "next";

import { FinanceReportsWorkspace } from "@/components/finance/financeReportsWorkspace";

export const metadata: Metadata = { title: "Finance reports" };

export default function FinanceReportsPage() {
  return <FinanceReportsWorkspace />;
}
