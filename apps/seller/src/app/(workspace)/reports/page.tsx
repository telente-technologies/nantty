import type { Metadata } from "next";

import { ReportsHubView } from "@/components/reports/reportsHubView";

export const metadata: Metadata = { title: "Reports" };

export default function ReportsHubPage() {
  return <ReportsHubView />;
}
