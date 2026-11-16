import type { Metadata } from "next";

import { FinanceAspectsWorkspace } from "@/components/finance/financeAspectsWorkspace";

export const metadata: Metadata = { title: "Revenue by aspect" };

export default function FinanceAspectsPage() {
  return <FinanceAspectsWorkspace />;
}
