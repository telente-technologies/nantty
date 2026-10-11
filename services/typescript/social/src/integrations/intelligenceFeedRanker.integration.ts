import type { FeedRanker, RankedCandidate, RankingCandidate, RankingContext, RankingExplanation } from "../interfaces/feedRanker.interface.js";
import type { IdentifierHasher } from "../utils/identifierHashing.util.js";
import { createCircuitBreaker, signIntelligenceRequest } from "../utils/intelligenceRequestSigning.util.js";
import { defaultBoostPolicy } from "./deterministicFeedRanker.integration.js";

export interface IntelligenceFeedRankerOptions {
  readonly baseUrl: string;
  readonly sharedSecret: string;
  readonly timeoutMs: number;
  readonly fallback: FeedRanker;
  readonly hasher: IdentifierHasher;
  readonly fetchImplementation?: typeof fetch;
  readonly onFallback?: (reason: string) => void;
}

interface RankedItemPayload {
  readonly itemId?: unknown;
  readonly explanations?: readonly RankingExplanation[];
  readonly boostMultiplier?: unknown;
  readonly trustedEngagementShare?: unknown;
}

const rankPath = "/v1/feed/rank";
const topicSlugPattern = /^[a-z0-9_-]{1,64}$/;
const maximumCandidatesSent = 500;
const maximumItemsReturned = 100;

export const toTopicSlugs = (values: readonly string[] | undefined): string[] => [...new Set((values ?? []).filter((value) => topicSlugPattern.test(value)))].slice(0, 20);

export function buildIntelligenceFeedRequest(candidates: readonly RankingCandidate[], context: RankingContext, hasher: IdentifierHasher) {
  const policy = context.boostPolicy ?? defaultBoostPolicy;
  return {
    feedMode: "for_you",
    viewer: {
      userId: context.viewerId === null || !context.personalized ? "guest" : hasher.hashUserId(context.viewerId),
      ...(context.viewerCountry ? { country: context.viewerCountry } : {}),
      followedAccountIds: context.personalized ? [...new Set(candidates.filter((candidate) => candidate.followedAuthor).map((candidate) => hasher.hashUserId(candidate.authorId)))].slice(0, 5000) : [],
    },
    candidates: candidates.slice(0, maximumCandidatesSent).map((candidate) => ({
      itemId: candidate.postId,
      authorId: hasher.hashUserId(candidate.authorId),
      createdAt: candidate.createdAt.toISOString(),
      mediaKind: "image",
      likeCount: candidate.likeCount,
      commentCount: candidate.commentCount,
      shareCount: candidate.shareCount,
      repostCount: candidate.repostCount,
      saveCount: candidate.saveCount ?? 0,
      viewCount: candidate.viewCount,
      hashtags: toTopicSlugs(candidate.hashtags),
      authorTier: candidate.authorTier ?? "none",
      authorIsOfficial: candidate.authorIsOfficial ?? false,
      isPromoted: candidate.isPromoted ?? false,
      ...(candidate.authorCountry ? { country: candidate.authorCountry } : {}),
      ...(candidate.integrity === undefined ? {} : { integrity: candidate.integrity }),
    })),
    limit: Math.max(1, Math.min(candidates.length, maximumItemsReturned)),
    boostPolicy: { version: policy.version, tierBoosts: policy.tierBoosts, officialEditorialBoost: policy.officialEditorialBoost },
    trendingTopics: toTopicSlugs(context.trendingHashtags).slice(0, 50),
    now: context.now.toISOString(),
  };
}

export function mergeIntelligenceRanking(candidates: readonly RankingCandidate[], fallbackOrder: readonly RankedCandidate[], items: readonly RankedItemPayload[], manipulatedIds: ReadonlySet<string>): RankedCandidate[] {
  const byId = new Map(candidates.map((candidate) => [candidate.postId, candidate]));
  const ranked: RankedCandidate[] = [];
  const placed = new Set<string>();
  for (const item of items) {
    if (typeof item.itemId !== "string") continue;
    const candidate = byId.get(item.itemId);
    if (candidate === undefined || placed.has(item.itemId)) continue;
    placed.add(item.itemId);
    ranked.push({
      ...candidate,
      explanations: Array.isArray(item.explanations) ? item.explanations.filter((entry) => typeof entry?.code === "string" && typeof entry.label === "string") : [],
      boostMultiplier: typeof item.boostMultiplier === "number" ? item.boostMultiplier : 1,
      trustedEngagementShare: typeof item.trustedEngagementShare === "number" ? item.trustedEngagementShare : 1,
      manipulated: manipulatedIds.has(item.itemId),
    });
  }
  for (const candidate of fallbackOrder) if (!placed.has(candidate.postId)) ranked.push(candidate);
  return ranked;
}

export type IntelligenceRequestBuilder = (candidates: readonly RankingCandidate[], context: RankingContext, hasher: IdentifierHasher) => unknown;

export function createSignedIntelligenceRanker(options: IntelligenceFeedRankerOptions, path: string, buildRequest: IntelligenceRequestBuilder): FeedRanker {
  const send = options.fetchImplementation ?? fetch;
  const breaker = createCircuitBreaker();
  return {
    async rank(candidates, context) {
      const fallbackOrder = await options.fallback.rank(candidates, context);
      if (candidates.length < 2) return fallbackOrder;
      if (breaker.isOpen()) {
        options.onFallback?.("circuit_open");
        return fallbackOrder;
      }
      const body = JSON.stringify(buildRequest(candidates, context, options.hasher));
      try {
        const response = await send(new URL(path, options.baseUrl), { method: "POST", body, headers: signIntelligenceRequest(options.sharedSecret, "POST", path, body), signal: AbortSignal.timeout(options.timeoutMs) });
        if (!response.ok) throw new Error(`${path} responded ${response.status}`);
        const payload = (await response.json()) as { items?: readonly RankedItemPayload[]; manipulatedItemIds?: readonly unknown[] };
        breaker.recordSuccess();
        const manipulated = new Set((payload.manipulatedItemIds ?? []).filter((id): id is string => typeof id === "string"));
        return mergeIntelligenceRanking(candidates, fallbackOrder, payload.items ?? [], manipulated);
      } catch (error) {
        breaker.recordFailure();
        options.onFallback?.(error instanceof Error ? error.name : "error");
        return fallbackOrder;
      }
    },
  };
}

export function createIntelligenceFeedRanker(options: IntelligenceFeedRankerOptions): FeedRanker {
  return createSignedIntelligenceRanker(options, rankPath, buildIntelligenceFeedRequest);
}
