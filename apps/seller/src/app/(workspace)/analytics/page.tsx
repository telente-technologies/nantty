import type { Metadata } from "next";

import { AnalyticsView } from "@/components/analytics/analyticsView";

export const metadata: Metadata = { title: "Sales & analytics" };

export default function AnalyticsPage() {
  return <AnalyticsView />;
}
