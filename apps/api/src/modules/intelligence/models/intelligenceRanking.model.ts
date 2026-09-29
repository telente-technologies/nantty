export interface IntelligenceMoney {
  readonly amountMinor: number;
  readonly currency: string;
}

export interface ExchangeRateToUsd {
  readonly currency: string;
  readonly usdPerMajorUnit: string;
}

export interface ViewerContext {
  readonly userId: string;
  readonly country?: string | null;
  readonly region?: string | null;
  readonly chosenTopics?: readonly string[];
  readonly ageBracket?: string | null;
  readonly followedAccountIds?: readonly string[];
  readonly blockedAccountIds?: readonly string[];
  readonly mutedAccountIds?: readonly string[];
  readonly hiddenItemIds?: readonly string[];
  readonly seenItemIds?: readonly string[];
}

export interface RankingResponseMetadata {
  readonly requestId: string;
  readonly rankingSource: string;
  readonly modelVersion?: string | null;
  readonly degraded: boolean;
  readonly generatedAt: string;
}

export interface ExcludedItem {
  readonly itemId: string;
  readonly reason: string;
}

export type FriendAction = "liked" | "commented" | "shared" | "purchased";

export interface FriendEngagement {
  readonly friendId: string;
  readonly action: FriendAction;
  readonly closeness?: number | null;
}

export interface FeedCandidate {
  readonly itemId: string;
  readonly authorId: string;
  readonly storeId: string | null;
  readonly contentKind: "personal" | "product";
  readonly mediaKind: "image" | "video" | "text" | "carousel";
  readonly mediaCount: number;
  readonly createdAt: string;
  readonly topics: readonly string[];
  readonly hashtags: readonly string[];
  readonly likeCount: number;
  readonly commentCount: number;
  readonly shareCount: number;
  readonly viewCount: number;
  readonly authorFollowerCount: number;
  readonly authorIsVerified: boolean;
  readonly isSensitive: boolean;
  readonly isReported: boolean;
  readonly friendEngagements: readonly FriendEngagement[];
}

export interface FeedRankingOptions {
  readonly maxConsecutiveSameAuthor?: number;
  readonly includeSocialProof?: boolean;
  readonly socialProofMinimumCloseFriends?: number;
  readonly socialProofMinimumGap?: number;
}

export interface FeedRankingRequest {
  readonly requestId: string;
  readonly feedMode: "for_you" | "following";
  readonly viewer: ViewerContext;
  readonly candidates: readonly FeedCandidate[];
  readonly limit: number;
  readonly options?: FeedRankingOptions;
  readonly now: string;
}

export interface SocialProofBanner {
  readonly friendIds: readonly string[];
  readonly totalFriendCount: number;
  readonly primaryAction: FriendAction;
}

export interface RankedFeedItem {
  readonly itemId: string;
  readonly position: number;
  readonly score: number;
  readonly reasons: readonly string[];
  readonly socialProof?: SocialProofBanner | null;
}

export interface FeedRankingResponse {
  readonly items: readonly RankedFeedItem[];
  readonly excluded: readonly ExcludedItem[];
  readonly metadata: RankingResponseMetadata;
}

export interface ClipCandidate {
  readonly itemId: string;
  readonly creatorId: string;
  readonly createdAt: string;
  readonly durationMs: number;
  readonly topics: readonly string[];
  readonly hashtags: readonly string[];
  readonly viewCount: number;
  readonly completionCount: number;
  readonly rewatchCount: number;
  readonly creatorFollowerCount: number;
  readonly creatorIsNew: boolean;
  readonly isSensitive: boolean;
}

export interface ClipRankingRequest {
  readonly requestId: string;
  readonly viewer: ViewerContext;
  readonly candidates: readonly ClipCandidate[];
  readonly limit: number;
  readonly explorationShare?: number;
  readonly now: string;
}

export interface RankedClipItem {
  readonly itemId: string;
  readonly position: number;
  readonly score: number;
  readonly isExploration: boolean;
  readonly reasons: readonly string[];
}

export interface ClipRankingResponse {
  readonly items: readonly RankedClipItem[];
  readonly excluded: readonly ExcludedItem[];
  readonly metadata: RankingResponseMetadata;
}

export interface SearchResultCandidate {
  readonly itemId: string;
  readonly itemType: "post" | "clip" | "product" | "store" | "account" | "hashtag";
  readonly textRelevanceScore: number;
  readonly authorId?: string | null;
  readonly topics?: readonly string[];
  readonly popularityCount: number;
  readonly createdAt?: string | null;
}

export interface SearchRerankRequest {
  readonly requestId: string;
  readonly viewer: ViewerContext;
  readonly candidates: readonly SearchResultCandidate[];
  readonly limit: number;
  readonly now: string;
}

export interface SearchRerankResponse {
  readonly items: readonly { readonly itemId: string; readonly position: number; readonly score: number }[];
  readonly metadata: RankingResponseMetadata;
}

export type ProductRecommendationSurface = "similar" | "bought_together" | "featured_with" | "mart_home";

export interface ProductCandidate {
  readonly productId: string;
  readonly storeId: string;
  readonly categoryId?: string | null;
  readonly topics?: readonly string[];
  readonly price?: IntelligenceMoney | null;
  readonly rating?: number | null;
  readonly salesCount: number;
  readonly viewCount: number;
  readonly inStock: boolean;
}

export interface ProductRecommendationRequest {
  readonly requestId: string;
  readonly surface: ProductRecommendationSurface;
  readonly viewer: ViewerContext;
  readonly anchorProduct?: ProductCandidate | null;
  readonly candidates: readonly ProductCandidate[];
  readonly limit: number;
  readonly now: string;
}

export interface RecommendationResponse {
  readonly items: readonly { readonly itemId: string; readonly score: number; readonly reason: string }[];
  readonly metadata: RankingResponseMetadata;
}

export type TrendingKind = "hashtag" | "topic" | "post" | "clip" | "product";

export interface TrendingRequest {
  readonly kind: TrendingKind;
  readonly country: string | null;
  readonly limit: number;
  readonly minimumDistinctActors: number;
  readonly now: string;
}

export interface TrendingItem {
  readonly itemId: string;
  readonly score: number;
  readonly acceleration: number;
  readonly distinctActors: number;
}

export interface TrendingResponse {
  readonly kind: TrendingKind;
  readonly scope: string;
  readonly items: readonly TrendingItem[];
  readonly metadata: RankingResponseMetadata;
}
