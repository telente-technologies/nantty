import type { Metadata } from "next";

import { CampaignsPage } from "@/components/campaigns/campaignsPage";

export const metadata: Metadata = { title: "Campaigns" };

export default function CampaignsRoutePage() {
  return <CampaignsPage />;
}
