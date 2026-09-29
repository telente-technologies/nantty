import type { Metadata } from "next";

import { DisputeDetailView } from "@/components/orders/disputeDetailView";

export const metadata: Metadata = { title: "Dispute" };

export default async function DisputeDetailPage({ params }: { readonly params: Promise<{ disputeId: string }> }) {
  const { disputeId } = await params;
  return <DisputeDetailView disputeId={disputeId} />;
}
