import type { AdPlacementDecision, AdSelectionRequest, AdSelectionResponse, IntelligenceAdCandidate, IntelligenceAdPlacement } from "../../intelligence/models/intelligenceAds.model.js";
import { buildFallbackMetadata } from "../../intelligence/services/intelligenceFallbacks.service.js";
import { describeMaximumSingleChargeMinor } from "./adAuctionCandidates.service.js";

interface AdLoadRule {
  readonly firstAdAfterOrganicItems: number;
  readonly organicItemsBetweenAds: number;
}

const DEFAULT_GRID_COLUMNS = 2;

export const AD_LOAD_RULES: Readonly<Record<IntelligenceAdPlacement, AdLoadRule>> = {
  feed: { firstAdAfterOrganicItems: 3, organicItemsBetweenAds: 6 },
  clips: { firstAdAfterOrganicItems: 2, organicItemsBetweenAds: 4 },
  stories: { firstAdAfterOrganicItems: 2, organicItemsBetweenAds: 4 },
  mart: { firstAdAfterOrganicItems: DEFAULT_GRID_COLUMNS, organicItemsBetweenAds: 5 },
  search: { firstAdAfterOrganicItems: DEFAULT_GRID_COLUMNS, organicItemsBetweenAds: 5 },
  live_discovery: { firstAdAfterOrganicItems: 1, organicItemsBetweenAds: 7 },
  live: { firstAdAfterOrganicItems: 0, organicItemsBetweenAds: 50 },
};

function convertToUsdMicros(amountMinor: number, currency: string, request: AdSelectionRequest): number | undefined {
  const rate = request.exchangeRates.find((entry) => entry.currency === currency);
  if (rate === undefined) return undefined;
  const exponent = ["JPY", "KRW", "XOF", "XAF", "UGX", "RWF"].includes(currency) ? 0 : ["KWD", "BHD", "OMR", "TND"].includes(currency) ? 3 : 2;
  return (amountMinor / 10 ** exponent) * Number(rate.usdPerMajorUnit) * 1_000_000;
}

function isEligible(candidate: IntelligenceAdCandidate, request: AdSelectionRequest): boolean {
  const now = Date.parse(request.now);
  const maximumCharge = describeMaximumSingleChargeMinor(candidate.bidType, candidate.bid.amountMinor);
  const withinSchedule = (candidate.startsAt === null || Date.parse(candidate.startsAt) <= now) && (candidate.endsAt === null || Date.parse(candidate.endsAt) > now);
  const fitsBudget = candidate.spentToday.amountMinor + maximumCharge <= candidate.dailyBudget.amountMinor && (candidate.totalBudget === null || candidate.spentTotal.amountMinor + maximumCharge <= candidate.totalBudget.amountMinor);
  const country = request.viewer.country ?? null;
  const geoMatches = candidate.targeting.countries.length === 0 || country === null || candidate.targeting.countries.includes(country);
  const frequencyOk = (request.viewerImpressionsTodayByCampaign[candidate.campaignId] ?? 0) < candidate.frequencyCapPerDay;
  return candidate.placements.includes(request.placement) && withinSchedule && fitsBudget && geoMatches && frequencyOk && candidate.bid.amountMinor > 0;
}

export function listFallbackSlotPositions(placement: IntelligenceAdPlacement, organicCount: number, maximumAds: number, hasHost: boolean): number[] {
  if (organicCount === 0) return hasHost && maximumAds > 0 ? [0] : [];
  const rule = AD_LOAD_RULES[placement];
  const positions: number[] = [];
  let organicBefore = Math.max(1, rule.firstAdAfterOrganicItems);
  while (organicBefore < organicCount && positions.length < maximumAds) {
    positions.push(organicBefore + positions.length);
    organicBefore += rule.organicItemsBetweenAds;
  }
  return positions;
}

export function selectAdsWithoutIntelligence(request: AdSelectionRequest): AdSelectionResponse {
  const ranked = request.candidates
    .filter((candidate) => isEligible(candidate, request))
    .map((candidate) => ({ candidate, usd: convertToUsdMicros(candidate.bid.amountMinor * (candidate.bidType === "cpm" ? 1 : 10), candidate.bid.currency, request) }))
    .filter((entry): entry is { candidate: IntelligenceAdCandidate; usd: number } => entry.usd !== undefined)
    .sort((left, right) => right.usd - left.usd || left.candidate.adId.localeCompare(right.candidate.adId));
  const oneAdPerAdvertiser = ranked.filter((entry, index) => ranked.findIndex((other) => other.candidate.advertiserId === entry.candidate.advertiserId) === index);
  const positions = listFallbackSlotPositions(request.placement, request.organicItems.length, request.adLoad.maximumAds, request.hostContentId !== null);
  const placements: AdPlacementDecision[] = positions.flatMap((position, slot) => {
    const winner = oneAdPerAdvertiser[slot];
    if (winner === undefined) return [];
    const organicIndexBefore = position - slot - 1;
    return [{
      adId: winner.candidate.adId,
      campaignId: winner.candidate.campaignId,
      advertiserId: winner.candidate.advertiserId,
      placement: request.placement,
      position,
      insertAfterItemId: request.organicItems[organicIndexBefore]?.itemId ?? null,
      hostContentId: request.hostContentId,
      hostCreatorId: request.hostCreatorId,
      chargeModel: winner.candidate.bidType,
      chargePrice: winner.candidate.bid,
      predictedClickRate: 0,
      auctionId: request.requestId,
    }];
  });
  return { placements, rejected: [], metadata: buildFallbackMetadata(request.requestId, "ads", request.now) };
}
