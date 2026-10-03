import type { Metadata } from "next";

import { SettlementDetailView } from "@/components/wallet/settlementDetailView";

export const metadata: Metadata = { title: "Settlement" };

export default async function SettlementDetailPage({ params }: { readonly params: Promise<{ readonly settlementId: string }> }) {
  const { settlementId } = await params;
  return <SettlementDetailView settlementId={settlementId} />;
}
