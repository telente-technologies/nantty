import type { AdSelectionRequest, AdSelectionResponse } from "../modules/intelligence/models/intelligenceAds.model.js";
import type { IntelligenceEventInput } from "../modules/intelligence/models/intelligenceEvents.model.js";
import type {
  ClipRankingRequest,
  ClipRankingResponse,
  FeedRankingRequest,
  FeedRankingResponse,
  ProductRecommendationRequest,
  RecommendationResponse,
  SearchRerankRequest,
  SearchRerankResponse,
  TrendingRequest,
  TrendingResponse,
} from "../modules/intelligence/models/intelligenceRanking.model.js";

export type RankingSource = "intelligence" | "fallback";

export interface RankingOutcome<T> {
  readonly response: T;
  readonly source: RankingSource;
}

export interface IntelligenceRanking {
  rankFeed(request: FeedRankingRequest): Promise<RankingOutcome<FeedRankingResponse>>;
  rankClips(request: ClipRankingRequest): Promise<RankingOutcome<ClipRankingResponse>>;
  rerankSearch(request: SearchRerankRequest): Promise<RankingOutcome<SearchRerankResponse>>;
  recommendProducts(request: ProductRecommendationRequest): Promise<RankingOutcome<RecommendationResponse>>;
  readTrending(request: TrendingRequest, computeFallback: () => Promise<TrendingResponse>): Promise<RankingOutcome<TrendingResponse>>;
  selectAds(request: AdSelectionRequest): Promise<AdSelectionResponse | undefined>;
}

export interface IdentifierHasher {
  hashUserId(userId: string): string;
  hashSearchQuery(queryText: string): string;
  createUserIdLookup(userIds: readonly string[]): Map<string, string>;
}

export interface IntelligenceEventSink {
  record(event: IntelligenceEventInput): Promise<void>;
}
