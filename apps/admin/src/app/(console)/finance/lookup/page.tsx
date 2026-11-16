import type { Metadata } from "next";
import { Suspense } from "react";

import { FinanceLookupWorkspace } from "@/components/finance/financeLookupWorkspace";

export const metadata: Metadata = { title: "Reference lookup" };

export default function FinanceLookupPage() {
  return (
    <Suspense fallback={null}>
      <FinanceLookupWorkspace />
    </Suspense>
  );
}
