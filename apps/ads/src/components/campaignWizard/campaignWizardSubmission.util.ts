import type { CampaignWizardState, WizardAdDraft, WizardAppDraft, WizardCardDraft } from "@/components/campaignWizard/campaignWizardState.store";
import type { AdAccount } from "@/types/adAccount.type";
import type { AudienceEstimateRequest } from "@/types/audience.type";
import type { AdPlacement, BidStrategy, Budget, CampaignDraftSubmission, Schedule } from "@/types/campaign.type";
import type { Creative, CreativeApp, CreativeCard, CreativeCardInput, CreativeDestination, CreativeInput } from "@/types/creative.type";
import type { CreativeShape } from "@/utils/adPlacementRules.util";
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

function hasUtm(ad: WizardAdDraft): boolean {
  return Object.values(ad.utm).some((value) => Boolean(value?.trim()));
}

function buildDestinationFromParts(ad: WizardAdDraft, type: CreativeDestination["type"], url: string, targetId: string | null): CreativeDestination {
  return { type, targetId, url: type === "url" ? url.trim() : null, ...(type === "url" && hasUtm(ad) ? { utm: ad.utm } : {}) };
}

export function buildAppFromDraft(app: WizardAppDraft): CreativeApp {
  const rating = app.ratingText.trim() ? Number(app.ratingText) : null;
  return {
    appName: app.appName.trim(),
    ...(app.iconMedia ? { iconMediaId: app.iconMedia.id, iconUrl: app.iconMedia.url } : {}),
    rating: rating !== null && Number.isFinite(rating) ? rating : null,
    iosStoreUrl: app.iosStoreUrl.trim(),
    androidStoreUrl: app.androidStoreUrl.trim(),
    webFallbackUrl: app.webFallbackUrl.trim(),
    iosDeepLink: app.iosDeepLink.trim(),
    androidDeepLink: app.androidDeepLink.trim(),
  };
}

function buildCardInput(ad: WizardAdDraft, card: WizardCardDraft): CreativeCardInput {
  return { mediaId: card.media?.id ?? "", headline: card.headline.trim(), description: card.description.trim(), callToAction: card.callToAction, destination: buildDestinationFromParts(ad, card.destinationType, card.destinationUrl, null) };
}

function buildPreviewCard(ad: WizardAdDraft, card: WizardCardDraft, index: number): CreativeCard {
  const placeholderMedia = { id: `empty-${index}`, kind: "image" as const, url: "", posterUrl: null, width: 1, height: 1, durationSeconds: null };
  return { media: card.media ?? placeholderMedia, headline: card.headline || `Card ${index + 1}`, description: card.description, callToAction: card.callToAction, destination: buildDestinationFromParts(ad, card.destinationType, card.destinationUrl, null) };
}

export function buildCreativeInputFromAdDraft(ad: WizardAdDraft): CreativeInput {
  const isInstall = ad.creativeType === "app_install";
  return {
    type: ad.creativeType,
    mediaClickable: ad.creativeType === "single" && ad.mediaClickable,
    cards: ad.creativeType === "carousel" ? ad.cards.map((card) => buildCardInput(ad, card)) : [],
    app: isInstall ? buildAppFromDraft(ad.app) : null,
    format: ad.format,
    source: { type: ad.sourceType, id: ad.sourceType === "upload" ? "" : (ad.selectedSource?.id ?? "") },
    mediaIds: ad.sourceType === "upload" ? ad.uploadedMedia.map((media) => media.id) : [],
    headline: ad.headline.trim(),
    primaryText: ad.primaryText.trim(),
    callToAction: ad.callToAction,
    destination: isInstall ? { type: "app_store", targetId: null, url: null } : buildDestinationFromParts(ad, ad.destinationType, ad.destinationUrl, ad.selectedSource?.id ?? null),
  };
}

export function buildPreviewCreativeFromAdDraft(ad: WizardAdDraft, account: AdAccount): Creative {
  return {
    type: ad.creativeType,
    mediaClickable: ad.creativeType === "single" && ad.mediaClickable,
    cards: ad.creativeType === "carousel" ? ad.cards.map((card, index) => buildPreviewCard(ad, card, index)) : [],
    app: ad.creativeType === "app_install" ? buildAppFromDraft(ad.app) : null,
    format: ad.format,
    source: { type: ad.sourceType, id: ad.selectedSource?.id ?? "" },
    media: ad.sourceType === "upload" ? ad.uploadedMedia : (ad.selectedSource?.media ?? []),
    headline: ad.headline || "Your headline",
    primaryText: ad.primaryText,
    callToAction: ad.callToAction,
    destination: ad.creativeType === "app_install" ? { type: "app_store", targetId: null, url: null } : buildDestinationFromParts(ad, ad.destinationType, ad.destinationUrl, ad.selectedSource?.id ?? null),
    identity: {
      name: account.business?.storeName ?? account.name,
      handle: account.business?.handle ?? account.name.toLowerCase().replace(/[^a-z0-9]+/g, "."),
      avatarUrl: account.business?.logoUrl ?? null,
      verifiedBusiness: account.verifiedBusiness,
    },
    product: ad.sourceType === "upload" ? null : (ad.selectedSource?.product ?? null),
    live: ad.sourceType === "live" ? (ad.selectedSource?.live ?? null) : null,
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

export function buildCreativeShapeFromAdDraft(ad: WizardAdDraft): CreativeShape {
  const cardMedia = ad.creativeType === "carousel" ? ad.cards.flatMap((card) => (card.media ? [card.media] : [])) : [];
  const media = cardMedia.length > 0 ? cardMedia : ad.sourceType === "upload" ? ad.uploadedMedia : (ad.selectedSource?.media ?? []);
  return { creativeType: ad.creativeType, sourceType: ad.sourceType, media, hasProduct: ad.sourceType !== "upload" && Boolean(ad.selectedSource?.product), hasLiveStream: ad.sourceType === "live" && Boolean(ad.selectedSource?.live) };
}
