import type { Metadata } from "next";

import { ReportsWorkspace } from "@/components/trust/reportsWorkspace";

export const metadata: Metadata = { title: "Reports" };

export default function ModerationReportsPage() {
  return <ReportsWorkspace />;
}
