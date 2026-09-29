import type { Metadata } from "next";

import { DisputeDetailWorkspace } from "@/components/money/disputeDetailWorkspace";

export const metadata: Metadata = { title: "Dispute" };

export default async function DisputeDetailPage({ params }: { readonly params: Promise<{ readonly disputeId: string }> }) {
  const { disputeId } = await params;
  return <DisputeDetailWorkspace disputeId={decodeURIComponent(disputeId)} />;
}
