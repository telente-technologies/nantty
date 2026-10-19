import type { Metadata } from "next";

import { CampaignWizard } from "@/components/campaignWizard/campaignWizard";
import { objectiveOptions } from "@/constants/campaignOptions.constant";
import type { CampaignObjective } from "@/types/campaign.type";

export const metadata: Metadata = { title: "Create campaign" };

function readPreselectedObjective(value: string | string[] | undefined): CampaignObjective | null {
  const candidate = Array.isArray(value) ? value[0] : value;
  return objectiveOptions.find((option) => option.objective === candidate)?.objective ?? null;
}

export default async function CreateCampaignPage({ searchParams }: { readonly searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const { objective } = await searchParams;
  return <CampaignWizard preselectedObjective={readPreselectedObjective(objective)} />;
}
