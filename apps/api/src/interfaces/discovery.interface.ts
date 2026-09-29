import type { IdentifierHasher, IntelligenceEventSink, IntelligenceRanking } from "./intelligence.interface.js";

export type SponsoredSurface = "feed" | "clips" | "mart" | "search" | "live";
export type SponsoredItemKind = "post" | "clip" | "product" | "live";

export interface SponsoredDto {
  readonly campaignId: string;
  readonly label: "Sponsored" | "Ad";
  readonly advertiserName: string;
  readonly ctaLabel?: string;
  readonly ctaUrl?: string;
}

export interface OrganicSlot {
  readonly itemId: string;
  readonly creatorUserId?: string;
  readonly isSensitive?: boolean;
  readonly isReported?: boolean;
}

export interface SponsoredPlacementRequest {
  readonly viewerId: string | undefined;
  readonly surface: SponsoredSurface;
  readonly organicItems: readonly OrganicSlot[];
  readonly country: string | null;
  readonly maximumAds?: number;
}

export interface SponsoredInsertion {
  readonly position: number;
  readonly itemKind: SponsoredItemKind;
  readonly itemId: string;
  readonly sponsored: SponsoredDto;
}

export interface SponsoredContentProvider {
  selectSponsoredItems(request: SponsoredPlacementRequest): Promise<readonly SponsoredInsertion[]>;
}

export interface DiscoveryServices {
  readonly ranking: IntelligenceRanking;
  readonly hasher: IdentifierHasher;
  readonly eventSink: IntelligenceEventSink;
  readonly sponsoredContent: SponsoredContentProvider;
}
