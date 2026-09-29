export const campaignWizardSteps = [
  { key: "objective", label: "Objective", description: "What you want people to do" },
  { key: "campaign", label: "Campaign", description: "Name, budget type and spend cap" },
  { key: "audience", label: "Audience & placements", description: "Who sees the ads and where" },
  { key: "budget", label: "Budget & schedule", description: "How much, when and how to bid" },
  { key: "ads", label: "Ads", description: "Creative, text and button" },
  { key: "review", label: "Review", description: "Check everything and publish" },
] as const;

export type CampaignWizardStepKey = (typeof campaignWizardSteps)[number]["key"];

export function findStepIndexForApiIssuePath(path: string): number {
  if (path.startsWith("campaign.objective")) return 0;
  if (path.startsWith("campaign.name") || path.startsWith("campaign.spendCap")) return 1;
  if (path.startsWith("campaign.budget") || path.startsWith("campaign.schedule")) return 3;
  if (path.startsWith("adSet.audience") || path.startsWith("adSet.placements") || path.startsWith("adSet.name")) return 2;
  if (path.startsWith("adSet.")) return 3;
  if (path.startsWith("ads")) return 4;
  return 5;
}
