import type { Metadata } from "next";
import { Suspense } from "react";

import { BillingReturnPage } from "@/components/billing/billingReturnPage";
import { LoadingBlock } from "@/components/ui/feedback";

export const metadata: Metadata = { title: "Payment status" };

export default function Page() {
  return (
    <Suspense fallback={<LoadingBlock label="Loading payment status" />}>
      <BillingReturnPage />
    </Suspense>
  );
}
