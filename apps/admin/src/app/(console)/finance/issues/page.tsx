import type { Metadata } from "next";

import { FinanceIssuesWorkspace } from "@/components/finance/financeIssuesWorkspace";

export const metadata: Metadata = { title: "Finance issues" };

export default function FinanceIssuesPage() {
  return <FinanceIssuesWorkspace />;
}
