export interface PromotedEntityView {
  readonly kind: "store" | "profile";
  readonly id: string;
  readonly name: string;
  readonly handle: string;
  readonly avatarUrl: string | null;
  readonly verified: boolean;
  readonly checkmarkColor?: string;
  readonly private: boolean;
}

export interface SponsoredPlacementView {
  readonly campaignId: string;
  readonly label: "Sponsored" | "Promoted" | "Boosted";
  readonly advertiserName: string;
  readonly ctaLabel?: string;
  readonly ctaUrl?: string;
  readonly adType?: string;
  readonly impressionToken?: string;
  readonly clickLinks?: { readonly media?: string; readonly cta?: string; readonly cards?: readonly string[] };
  readonly destination?: { readonly type: string; readonly targetId?: string | null; readonly url?: string | null };
  readonly mediaClickable?: boolean;
  readonly cards?: readonly unknown[];
  readonly app?: unknown;
  readonly promoted?: PromotedEntityView;
}

export interface DecidedAdCreative {
  readonly type: string;
  readonly mediaClickable: boolean;
  readonly cards?: readonly unknown[];
  readonly app?: unknown;
  readonly source: { readonly type: string; readonly id: string };
  readonly media: readonly { readonly id: string; readonly kind: string; readonly url: string; readonly posterUrl: string | null; readonly width: number; readonly height: number; readonly durationSeconds: number | null }[];
  readonly headline: string;
  readonly primaryText: string;
  readonly callToAction: string;
  readonly destination: { readonly type: string; readonly targetId: string | null; readonly url: string | null };
  readonly identity: { readonly name: string; readonly handle: string; readonly avatarUrl: string | null; readonly verifiedBusiness: boolean };
  readonly promoted?: PromotedEntityView;
}

export interface DecidedAd {
  readonly adId: string;
  readonly impressionToken: string;
  readonly label: string;
  readonly creative: DecidedAdCreative;
  readonly clickLinks: { readonly media?: string; readonly cta?: string; readonly cards?: readonly string[] } | null;
}

export interface AdSlotRequest {
  readonly userId: string;
  readonly sessionId: string;
  readonly slotKind: "feedPost" | "clipBetween";
  readonly neighbourContentIds: readonly string[];
  readonly slotsSinceLastAd: number;
  readonly slotIndex: number;
  readonly viewer: { readonly country: string | null; readonly topics: readonly string[]; readonly premiumAdFree: boolean };
}

export interface AdDecisionClient {
  decide(request: AdSlotRequest): Promise<DecidedAd | null>;
}
