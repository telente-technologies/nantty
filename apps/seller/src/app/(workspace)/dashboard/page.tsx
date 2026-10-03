import type { Metadata } from "next";

import { DashboardView } from "@/components/dashboard/dashboardView";

export const metadata: Metadata = { title: "Overview" };

export default function DashboardPage() {
  return <DashboardView />;
}
