import type { Metadata } from "next";

import { OverviewPage } from "@/components/overview/overviewPage";

export const metadata: Metadata = { title: "Overview" };

export default function AccountOverviewPage() {
  return <OverviewPage />;
}
