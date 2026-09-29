import type { CampaignWizardState, WizardAdDraft } from "@/components/campaignWizard/campaignWizardState.store";
import type { AdAccount } from "@/types/adAccount.type";
import type { AudienceEstimateRequest } from "@/types/audience.type";
import type { AdPlacement, BidStrategy, Budget, CampaignDraftSubmission, Schedule } from "@/types/campaign.type";
import type { Creative, CreativeInput } from "@/types/creative.type";
import { parseTypedMajorAmountToMoney } from "@/utils/money.util";

const everyPlacement: readonly AdPlacement[] = ["feed", "clips", "mart", "search", "stories", "live"];

function convertLocalDateTimeToIso(localValue: string): string | null {
  if (!localValue) return null;
  const date = new Date(localValue);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

export function buildScheduleFromWizard(state: CampaignWizardState): Schedule {
  return { startAt: convertLocalDateTimeToIso(state.startAtLocal) ?? new Date().toISOString(), endAt: convertLocalDateTimeToIso(state.endAtLocal) };
}

export function buildBudgetFromWizard(state: CampaignWizardState, currency: string): Budget | null {
  const amount = parseTypedMajorAmountToMoney(state.budgetAmountText, currency);
  return amount && amount.amountMinor > 0 ? { type: state.budgetType, amount } : null;
}

export function buildBidStrategyFromWizard(state: CampaignWizardState, currency: string): BidStrategy {
  return { type: state.bidType, amount: state.bidType === "auto" ? null : parseTypedMajorAmountToMoney(state.bidAmountText, currency) };
}

export function readChosenPlacements(state: CampaignWizardState): readonly AdPlacement[] {
  return state.placementMode === "automatic" ? everyPlacement : state.placements;
}

export function buildCreativeInputFromAdDraft(ad: WizardAdDraft): CreativeInput {
  return {
    format: ad.format,
    source: { type: ad.sourceType, id: ad.sourceType === "upload" ? "" : (ad.selectedSource?.id ?? "") },
    mediaIds: ad.sourceType === "upload" ? ad.uploadedMedia.map((media) => media.id) : [],
    headline: ad.headline.trim(),
    primaryText: ad.primaryText.trim(),
    callToAction: ad.callToAction,
    destination: { type: ad.destinationType, targetId: ad.selectedSource?.id ?? null, url: ad.destinationType === "url" ? ad.destinationUrl.trim() : null },
  };
}

export function buildPreviewCreativeFromAdDraft(ad: WizardAdDraft, account: AdAccount): Creative {
  return {
    format: ad.format,
    source: { type: ad.sourceType, id: ad.selectedSource?.id ?? "" },
    media: ad.sourceType === "upload" ? ad.uploadedMedia : (ad.selectedSource?.media ?? []),
    headline: ad.headline || "Your headline",
    primaryText: ad.primaryText,
    callToAction: ad.callToAction,
    destination: { type: ad.destinationType, targetId: ad.selectedSource?.id ?? null, url: ad.destinationUrl || null },
    identity: {
      name: account.business?.storeName ?? account.name,
      handle: account.business?.handle ?? account.name.toLowerCase().replace(/[^a-z0-9]+/g, "."),
      avatarUrl: account.business?.logoUrl ?? null,
      verifiedBusiness: account.verifiedBusiness,
    },
    product: ad.sourceType === "upload" ? null : (ad.selectedSource?.product ?? null),
  };
}

export function buildCampaignSubmissionFromWizard(state: CampaignWizardState, currency: string, submitForReview: boolean): CampaignDraftSubmission {
  const schedule = buildScheduleFromWizard(state);
  const budget = buildBudgetFromWizard(state, currency);
  const spendCap = state.spendCapText.trim() ? parseTypedMajorAmountToMoney(state.spendCapText, currency) : null;
  return {
    campaign: { name: state.campaignName.trim(), objective: state.objective ?? "awareness", budgetLevel: state.budgetLevel, budget: state.budgetLevel === "campaign" ? budget : null, spendCap, schedule },
    adSet: {
      name: state.adSetName.trim(),
      audience: state.audience,
      placementMode: state.placementMode,
      placements: readChosenPlacements(state),
      schedule,
      budget: state.budgetLevel === "ad_set" ? budget : null,
      bidStrategy: buildBidStrategyFromWizard(state, currency),
      frequencyCap: state.isFrequencyCapEnabled ? { impressions: Number(state.frequencyImpressionsText), perDays: Number(state.frequencyPerDaysText) } : null,
      conversionEventId: state.objective === "sales" && state.conversionEventId ? state.conversionEventId : null,
    },
    ads: state.ads.map((ad) => ({ name: ad.name.trim() || "Ad", creative: buildCreativeInputFromAdDraft(ad) })),
    submitForReview,
  };
}

export function buildEstimateRequestFromWizard(state: CampaignWizardState, currency: string): AudienceEstimateRequest {
  return {
    objective: state.objective ?? "awareness",
    audience: state.audience,
    placements: readChosenPlacements(state),
    budget: buildBudgetFromWizard(state, currency),
    bidStrategy: buildBidStrategyFromWizard(state, currency),
    schedule: buildScheduleFromWizard(state),
  };
}
