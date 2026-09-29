import type { Metadata } from "next";

import { CampaignWizard } from "@/components/campaignWizard/campaignWizard";

export const metadata: Metadata = { title: "Create campaign" };

export default function CreateCampaignPage() {
  return <CampaignWizard />;
}
