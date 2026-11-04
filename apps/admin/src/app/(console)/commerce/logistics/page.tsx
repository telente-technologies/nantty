import type { Metadata } from "next";

import { LogisticsWorkspace } from "@/components/money/logisticsWorkspace";

export const metadata: Metadata = { title: "Logistics" };

export default function LogisticsPage() {
  return <LogisticsWorkspace />;
}
