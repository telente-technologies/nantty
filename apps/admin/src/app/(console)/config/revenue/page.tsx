import type { Metadata } from "next";

import { RevenueRulesWorkspace } from "@/components/configuration/revenue/revenueRulesWorkspace";

export const metadata: Metadata = { title: "Revenue rules" };

export default function RevenueRulesPage() {
  return <RevenueRulesWorkspace />;
}
