import type { Metadata } from "next";

import { OverviewWorkspace } from "@/components/overview/overviewWorkspace";

export const metadata: Metadata = { title: "Overview" };

export default function OverviewPage() {
  return <OverviewWorkspace />;
}
