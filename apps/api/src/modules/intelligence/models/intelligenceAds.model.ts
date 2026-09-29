import type { ExchangeRateToUsd, IntelligenceMoney, RankingResponseMetadata, ViewerContext } from "./intelligenceRanking.model.js";

export type IntelligenceAdPlacement = "feed" | "clips" | "mart" | "search" | "stories" | "live" | "live_discovery";
export type IntelligenceAdMediaType = "image" | "video" | "carousel" | "live_stream" | "product_tile";
export type IntelligenceAspectRatio = "1:1" | "4:5" | "9:16" | "16:9";
export type IntelligenceBidType = "cpc" | "cpm";

export interface IntelligenceAdTargeting {
  readonly countries: readonly string[];
  readonly regions: readonly string[];
  readonly topics: readonly string[];
  readonly ageBrackets: readonly string[];
}

export interface IntelligenceAdCreative {
  readonly mediaType: IntelligenceAdMediaType;
  readonly aspectRatio: IntelligenceAspectRatio;
  readonly durationMs: number | null;
  readonly isLiveNow: boolean;
  readonly productId: string | null;
  readonly liveStreamId: string | null;
}

export interface IntelligenceAdCandidate {
  readonly adId: string;
  readonly campaignId: string;
  readonly advertiserId: string;
  readonly status: "active";
  readonly startsAt: string | null;
  readonly endsAt: string | null;
  readonly bidType: IntelligenceBidType;
  readonly bid: IntelligenceMoney;
  readonly dailyBudget: IntelligenceMoney;
  readonly totalBudget: IntelligenceMoney | null;
  readonly spentToday: IntelligenceMoney;
  readonly spentTotal: IntelligenceMoney;
  readonly frequencyCapPerDay: number;
  readonly placements: readonly IntelligenceAdPlacement[];
  readonly targeting: IntelligenceAdTargeting;
  readonly creative: IntelligenceAdCreative;
  readonly creativeTopics: readonly string[];
  readonly lifetimeImpressions: number;
  readonly lifetimeClicks: number;
}

export interface OrganicSlotItem {
  readonly itemId: string;
  readonly isSensitive: boolean;
  readonly isReported: boolean;
}

export interface AdLoadOptions {
  readonly firstAdAfterOrganicItems?: number;
  readonly organicItemsBetweenAds?: number;
  readonly maximumAds: number;
}

export interface AdSelectionRequest {
  readonly requestId: string;
  readonly placement: IntelligenceAdPlacement;
  readonly hostContentId: string | null;
  readonly hostCreatorId: string | null;
  readonly viewer: ViewerContext;
  readonly organicItems: readonly OrganicSlotItem[];
  readonly candidates: readonly IntelligenceAdCandidate[];
  readonly exchangeRates: readonly ExchangeRateToUsd[];
  readonly adLoad: AdLoadOptions;
  readonly viewerImpressionsTodayByCampaign: Readonly<Record<string, number>>;
  readonly now: string;
}

export interface AdPlacementDecision {
  readonly adId: string;
  readonly campaignId: string;
  readonly advertiserId: string;
  readonly placement: IntelligenceAdPlacement;
  readonly position: number;
  readonly insertAfterItemId: string | null;
  readonly hostContentId: string | null;
  readonly hostCreatorId: string | null;
  readonly chargeModel: IntelligenceBidType;
  readonly chargePrice: IntelligenceMoney;
  readonly predictedClickRate: number;
  readonly auctionId: string;
}

export interface AdSelectionResponse {
  readonly placements: readonly AdPlacementDecision[];
  readonly rejected: readonly { readonly adId: string; readonly reason: string }[];
  readonly metadata: RankingResponseMetadata;
}
