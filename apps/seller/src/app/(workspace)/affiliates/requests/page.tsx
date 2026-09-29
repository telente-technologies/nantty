import type { Metadata } from "next";

import { AffiliateRequestsView } from "@/components/affiliates/affiliateRequestsView";

export const metadata: Metadata = { title: "Creator requests" };

export default function AffiliateRequestsPage() {
  return <AffiliateRequestsView />;
}
