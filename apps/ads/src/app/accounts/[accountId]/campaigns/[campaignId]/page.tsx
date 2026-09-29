import type { Metadata } from "next";

import { CampaignDetailPage } from "@/components/campaigns/campaignDetailPage";

export const metadata: Metadata = { title: "Campaign" };

export default async function CampaignDetailRoutePage({ params }: { readonly params: Promise<{ campaignId: string }> }) {
  const { campaignId } = await params;
  return <CampaignDetailPage campaignId={campaignId} />;
}
