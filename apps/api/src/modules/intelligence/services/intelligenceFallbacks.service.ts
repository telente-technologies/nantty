import type {
  ClipRankingRequest,
  ClipRankingResponse,
  FeedCandidate,
  FeedRankingRequest,
  FeedRankingResponse,
  ProductRecommendationRequest,
  RankingResponseMetadata,
  RecommendationResponse,
  SearchRerankRequest,
  SearchRerankResponse,
  SocialProofBanner,
} from "../models/intelligenceRanking.model.js";

const SOCIAL_PROOF_MINIMUM_FRIENDS = 2;
const SOCIAL_PROOF_MINIMUM_GAP = 5;
const SOCIAL_PROOF_FRIEND_SAMPLE = 3;

export function buildFallbackMetadata(requestId: string, rankingSource: string, now: string): RankingResponseMetadata {
  return { requestId, rankingSource: `${rankingSource}:api_fallback`, modelVersion: null, degraded: true, generatedAt: now };
}

function calculateAgeHours(createdAt: string, now: string): number {
  return Math.max(0, Date.parse(now) - Date.parse(createdAt)) / 3_600_000;
}

export function calculateFallbackEngagementScore(candidate: FeedCandidate, now: string): number {
  const engagement = candidate.likeCount + 2 * candidate.commentCount + 3 * candidate.shareCount + 1;
  return engagement / (calculateAgeHours(candidate.createdAt, now) + 2) ** 1.5;
}

export function interleaveToAvoidConsecutiveOwners<T>(ordered: readonly T[], ownerOf: (item: T) => string): T[] {
  const remaining = [...ordered];
  const result: T[] = [];
  while (remaining.length > 0) {
    const previousOwner = result.length === 0 ? undefined : ownerOf(result[result.length - 1] as T);
    const nextIndex = remaining.findIndex((item) => ownerOf(item) !== previousOwner);
    const [next] = remaining.splice(nextIndex === -1 ? 0 : nextIndex, 1);
    result.push(next as T);
  }
  return result;
}

function moveSeenItemsLast<T extends { readonly itemId: string }>(items: readonly T[], seen: ReadonlySet<string>, limit: number): T[] {
  const unseen = items.filter((item) => !seen.has(item.itemId));
  return unseen.length >= limit ? unseen : [...unseen, ...items.filter((item) => seen.has(item.itemId))];
}

function selectFallbackSocialProof(candidate: FeedCandidate): SocialProofBanner | null {
  const friendIds = [...new Set(candidate.friendEngagements.map((engagement) => engagement.friendId))];
  if (friendIds.length < SOCIAL_PROOF_MINIMUM_FRIENDS) return null;
  const primaryAction = candidate.friendEngagements[0]?.action ?? "liked";
  return { friendIds: friendIds.slice(0, SOCIAL_PROOF_FRIEND_SAMPLE), totalFriendCount: friendIds.length, primaryAction };
}

export function rankFeedWithoutIntelligence(request: FeedRankingRequest): FeedRankingResponse {
  const excludedAccounts = new Set([...(request.viewer.blockedAccountIds ?? []), ...(request.viewer.mutedAccountIds ?? [])]);
  const hidden = new Set(request.viewer.hiddenItemIds ?? []);
  const eligible = request.candidates.filter(
    (candidate) => !excludedAccounts.has(candidate.authorId) && !(candidate.storeId !== null && excludedAccounts.has(candidate.storeId)) && !hidden.has(candidate.itemId),
  );
  const ordered = request.feedMode === "following"
    ? [...eligible].sort((left, right) => Date.parse(right.createdAt) - Date.parse(left.createdAt) || right.itemId.localeCompare(left.itemId))
    : interleaveToAvoidConsecutiveOwners(
      [...eligible].sort(
        (left, right) =>
          calculateFallbackEngagementScore(right, request.now) - calculateFallbackEngagementScore(left, request.now) ||
          Date.parse(right.createdAt) - Date.parse(left.createdAt) ||
          right.itemId.localeCompare(left.itemId),
      ),
      (candidate) => candidate.storeId ?? candidate.authorId,
    );
  const visible = moveSeenItemsLast(ordered, new Set(request.viewer.seenItemIds ?? []), request.limit).slice(0, request.limit);
  let lastBannerPosition = -SOCIAL_PROOF_MINIMUM_GAP;
  const items = visible.map((candidate, position) => {
    const banner = position - lastBannerPosition >= SOCIAL_PROOF_MINIMUM_GAP ? selectFallbackSocialProof(candidate) : null;
    if (banner !== null) lastBannerPosition = position;
    return { itemId: candidate.itemId, position, score: calculateFallbackEngagementScore(candidate, request.now), reasons: ["fallback"], socialProof: banner };
  });
  return { items, excluded: [], metadata: buildFallbackMetadata(request.requestId, request.feedMode, request.now) };
}

export function rankClipsWithoutIntelligence(request: ClipRankingRequest): ClipRankingResponse {
  const hidden = new Set(request.viewer.hiddenItemIds ?? []);
  const blocked = new Set([...(request.viewer.blockedAccountIds ?? []), ...(request.viewer.mutedAccountIds ?? [])]);
  const scoreOf = (candidate: ClipRankingRequest["candidates"][number]) =>
    ((candidate.completionCount + 1) / (candidate.viewCount + 2)) / (calculateAgeHours(candidate.createdAt, request.now) + 2);
  const sorted = request.candidates
    .filter((candidate) => !hidden.has(candidate.itemId) && !blocked.has(candidate.creatorId))
    .sort((left, right) => scoreOf(right) - scoreOf(left) || right.itemId.localeCompare(left.itemId));
  const ordered = moveSeenItemsLast(interleaveToAvoidConsecutiveOwners(sorted, (candidate) => candidate.creatorId), new Set(request.viewer.seenItemIds ?? []), request.limit);
  return {
    items: ordered.slice(0, request.limit).map((candidate, position) => ({ itemId: candidate.itemId, position, score: scoreOf(candidate), isExploration: false, reasons: ["fallback"] })),
    excluded: [],
    metadata: buildFallbackMetadata(request.requestId, "clips", request.now),
  };
}

export function rerankSearchWithoutIntelligence(request: SearchRerankRequest): SearchRerankResponse {
  const ordered = request.candidates
    .map((candidate, index) => ({ candidate, index }))
    .sort((left, right) => right.candidate.textRelevanceScore - left.candidate.textRelevanceScore || left.index - right.index)
    .slice(0, request.limit);
  return {
    items: ordered.map((entry, position) => ({ itemId: entry.candidate.itemId, position, score: entry.candidate.textRelevanceScore })),
    metadata: buildFallbackMetadata(request.requestId, "search", request.now),
  };
}

export function recommendProductsWithoutIntelligence(request: ProductRecommendationRequest): RecommendationResponse {
  const anchor = request.anchorProduct ?? null;
  const affinity = (candidate: ProductRecommendationRequest["candidates"][number]) =>
    (anchor !== null && anchor.categoryId !== undefined && anchor.categoryId !== null && candidate.categoryId === anchor.categoryId ? 2 : 0) +
    (anchor !== null && candidate.storeId === anchor.storeId ? 1 : 0);
  const ordered = request.candidates
    .filter((candidate) => candidate.inStock && candidate.productId !== anchor?.productId)
    .map((candidate, index) => ({ candidate, index }))
    .sort(
      (left, right) =>
        affinity(right.candidate) - affinity(left.candidate) ||
        right.candidate.salesCount - left.candidate.salesCount ||
        (right.candidate.rating ?? 0) - (left.candidate.rating ?? 0) ||
        left.index - right.index,
    )
    .slice(0, request.limit);
  return {
    items: ordered.map((entry) => ({ itemId: entry.candidate.productId, score: entry.candidate.salesCount, reason: affinity(entry.candidate) > 0 ? "similar" : "popular" })),
    metadata: buildFallbackMetadata(request.requestId, `products:${request.surface}`, request.now),
  };
}
