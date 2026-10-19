import type { Metadata } from "next";

import { UndeliveredReviewWorkspace } from "@/components/money/undeliveredReviewWorkspace";

export const metadata: Metadata = { title: "Undelivered orders" };

export default function UndeliveredOrdersPage() {
  return <UndeliveredReviewWorkspace />;
}
