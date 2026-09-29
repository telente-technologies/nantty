import type { Metadata } from "next";
import { Suspense } from "react";

import { ReportsPage } from "@/components/reports/reportsPage";
import { LoadingBlock } from "@/components/ui/feedback";

export const metadata: Metadata = { title: "Reports" };

export default function AccountReportsPage() {
  return (
    <Suspense fallback={<LoadingBlock label="Loading reports" height={320} />}>
      <ReportsPage />
    </Suspense>
  );
}
