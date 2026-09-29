import type { IntelligenceRanking, RankingOutcome } from "../../../interfaces/intelligence.interface.js";
import type { AdSelectionRequest, AdSelectionResponse } from "../models/intelligenceAds.model.js";
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
} from "../models/intelligenceRanking.model.js";
import type { IntelligenceTimeoutFamily, SignedIntelligenceClient } from "./intelligenceClient.service.js";
import {
  rankClipsWithoutIntelligence,
  rankFeedWithoutIntelligence,
  recommendProductsWithoutIntelligence,
  rerankSearchWithoutIntelligence,
} from "./intelligenceFallbacks.service.js";

const MAXIMUM_CANDIDATES = 500;

function keepKnownUniqueItems<T extends { readonly itemId: string }>(items: readonly T[] | undefined, knownIds: ReadonlySet<string>): T[] | undefined {
  if (!Array.isArray(items)) return undefined;
  const seen = new Set<string>();
  return items.filter((item) => {
    if (typeof item?.itemId !== "string" || !knownIds.has(item.itemId) || seen.has(item.itemId)) return false;
    seen.add(item.itemId);
    return true;
  });
}

export class ResilientIntelligence implements IntelligenceRanking {
  public constructor(private readonly client: SignedIntelligenceClient) {}

  public rankFeed(request: FeedRankingRequest): Promise<RankingOutcome<FeedRankingResponse>> {
    const bounded = { ...request, candidates: request.candidates.slice(0, MAXIMUM_CANDIDATES) };
    const knownIds = new Set(bounded.candidates.map((candidate) => candidate.itemId));
    return this.callOrFallBack("/v1/feed/rank", bounded, "ranking", rankFeedWithoutIntelligence, (response) => {
      const items = keepKnownUniqueItems(response.items, knownIds);
      return items === undefined ? undefined : { ...response, items, excluded: response.excluded ?? [] };
    });
  }

  public rankClips(request: ClipRankingRequest): Promise<RankingOutcome<ClipRankingResponse>> {
    const bounded = { ...request, candidates: request.candidates.slice(0, MAXIMUM_CANDIDATES) };
    const knownIds = new Set(bounded.candidates.map((candidate) => candidate.itemId));
    return this.callOrFallBack("/v1/clips/rank", bounded, "ranking", rankClipsWithoutIntelligence, (response) => {
      const items = keepKnownUniqueItems(response.items, knownIds);
      return items === undefined ? undefined : { ...response, items, excluded: response.excluded ?? [] };
    });
  }

  public rerankSearch(request: SearchRerankRequest): Promise<RankingOutcome<SearchRerankResponse>> {
    const bounded = { ...request, candidates: request.candidates.slice(0, MAXIMUM_CANDIDATES) };
    const knownIds = new Set(bounded.candidates.map((candidate) => candidate.itemId));
    return this.callOrFallBack("/v1/search/rerank", bounded, "ranking", rerankSearchWithoutIntelligence, (response) => {
      const items = keepKnownUniqueItems(response.items, knownIds);
      return items === undefined ? undefined : { ...response, items };
    });
  }

  public recommendProducts(request: ProductRecommendationRequest): Promise<RankingOutcome<RecommendationResponse>> {
    const bounded = { ...request, candidates: request.candidates.slice(0, MAXIMUM_CANDIDATES) };
    const knownIds = new Set(bounded.candidates.map((candidate) => candidate.productId));
    return this.callOrFallBack("/v1/recommendations/products", bounded, "recommendations", recommendProductsWithoutIntelligence, (response) => {
      const items = keepKnownUniqueItems(response.items, knownIds);
      return items === undefined ? undefined : { ...response, items };
    });
  }

  public async readTrending(request: TrendingRequest, computeFallback: () => Promise<TrendingResponse>): Promise<RankingOutcome<TrendingResponse>> {
    const result = await this.client.post<TrendingResponse>("/v1/trending", request, "recommendationsMs");
    if (result.ok && Array.isArray(result.value.items)) return { response: result.value, source: "intelligence" };
    return { response: await computeFallback(), source: "fallback" };
  }

  public async selectAds(request: AdSelectionRequest): Promise<AdSelectionResponse | undefined> {
    const result = await this.client.post<AdSelectionResponse>("/v1/ads/select", request, "adsMs");
    return result.ok && Array.isArray(result.value.placements) ? result.value : undefined;
  }

  private async callOrFallBack<Request, Response>(
    path: string,
    request: Request,
    family: "ranking" | "recommendations",
    fallback: (request: Request) => Response,
    validate: (response: Response) => Response | undefined,
  ): Promise<RankingOutcome<Response>> {
    const timeoutFamily: IntelligenceTimeoutFamily = family === "ranking" ? "rankingMs" : "recommendationsMs";
    const result = await this.client.post<Response>(path, request, timeoutFamily);
    const validated = result.ok ? validate(result.value) : undefined;
    return validated === undefined ? { response: fallback(request), source: "fallback" } : { response: validated, source: "intelligence" };
  }
}
