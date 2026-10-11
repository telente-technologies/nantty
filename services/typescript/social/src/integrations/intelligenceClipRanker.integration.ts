import type { FeedRanker, RankingCandidate, RankingContext } from "../interfaces/feedRanker.interface.js";
import type { IdentifierHasher } from "../utils/identifierHashing.util.js";
import { defaultBoostPolicy } from "./deterministicFeedRanker.integration.js";
import { createSignedIntelligenceRanker, toTopicSlugs, type IntelligenceFeedRankerOptions } from "./intelligenceFeedRanker.integration.js";

const clipRankPath = "/v1/clips/rank";
const maximumCandidatesSent = 500;
const maximumItemsReturned = 100;
const maximumClipDurationMs = 3_600_000;
const explorationShare = 0.2;

const lowercaseSlugs = (values: readonly string[] | undefined) => toTopicSlugs((values ?? []).map((value) => value.toLowerCase()));

export function buildIntelligenceClipRequest(candidates: readonly RankingCandidate[], context: RankingContext, hasher: IdentifierHasher) {
  const policy = context.boostPolicy ?? defaultBoostPolicy;
  const personalized = context.viewerId !== null && context.personalized;
  return {
    viewer: {
      userId: personalized && context.viewerId !== null ? hasher.hashUserId(context.viewerId) : "guest",
      ...(context.viewerCountry ? { country: context.viewerCountry } : {}),
      followedAccountIds: personalized ? [...new Set(candidates.filter((candidate) => candidate.followedAuthor).map((candidate) => hasher.hashUserId(candidate.authorId)))].slice(0, 5000) : [],
    },
    candidates: candidates.slice(0, maximumCandidatesSent).map((candidate) => {
      const watches = Math.max(candidate.videoViews ?? 0, candidate.viewCount);
      return {
        itemId: candidate.postId,
        creatorId: hasher.hashUserId(candidate.authorId),
        createdAt: candidate.createdAt.toISOString(),
        durationMs: Math.min(Math.max(Math.round(candidate.durationMs ?? 0), 0), maximumClipDurationMs),
        topics: lowercaseSlugs(candidate.topics),
        hashtags: lowercaseSlugs(candidate.hashtags),
        viewCount: watches,
        completionCount: Math.min(candidate.completedViews ?? 0, watches),
        likeCount: candidate.likeCount,
        commentCount: candidate.commentCount,
        shareCount: candidate.shareCount + candidate.repostCount,
        saveCount: candidate.saveCount ?? 0,
        authorTier: candidate.authorTier ?? "none",
        authorIsOfficial: candidate.authorIsOfficial ?? false,
        isPromoted: candidate.isPromoted ?? false,
        ...(candidate.authorCountry ? { country: candidate.authorCountry } : {}),
        ...(candidate.integrity === undefined ? {} : { integrity: candidate.integrity }),
      };
    }),
    limit: Math.max(1, Math.min(candidates.length, maximumItemsReturned)),
    explorationShare,
    personalized,
    boostPolicy: { version: policy.version, tierBoosts: policy.tierBoosts, officialEditorialBoost: policy.officialEditorialBoost },
    trendingTopics: lowercaseSlugs(context.trendingHashtags).slice(0, 50),
    now: context.now.toISOString(),
  };
}

export function createIntelligenceClipRanker(options: IntelligenceFeedRankerOptions): FeedRanker {
  return createSignedIntelligenceRanker(options, clipRankPath, buildIntelligenceClipRequest);
}
