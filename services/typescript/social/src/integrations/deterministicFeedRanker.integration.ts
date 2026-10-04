import { defaultOfficialEditorialBoost, defaultTierBoost } from "../constants/ranking.constant.js";
import type { FeedRanker, RankedCandidate, RankingCandidate, RankingContext, RankingExplanation } from "../interfaces/feedRanker.interface.js";
import type { RankingBoostPolicy } from "../interfaces/rankingSettings.interface.js";
import { assessEngagementIntegrity, cleanIntegritySignals, type IntegrityAssessment } from "../utils/engagementIntegrity.util.js";
import { calculateCappedAuthorBoost, clampBoostPolicyToHardCaps } from "../utils/rankingBoostPolicy.util.js";

const halfLifeHours = 18;
const followingMultiplier = 1.25;
const maximumPostsPerAuthorPerPage = 3;
const authorWindowSize = 30;

export const defaultBoostPolicy: RankingBoostPolicy = { version: 0, tierBoosts: defaultTierBoost, officialEditorialBoost: defaultOfficialEditorialBoost };

export function calculateWeightedInteractions(candidate: RankingCandidate, assessment: IntegrityAssessment): number {
  const raw = candidate.likeCount + 2 * (candidate.saveCount ?? 0) + 3 * candidate.commentCount + 4 * candidate.repostCount + 4 * candidate.shareCount;
  return raw * assessment.trustedEngagementShare;
}

export function scoreCandidateQuality(candidate: RankingCandidate, now: Date, assessment: IntegrityAssessment = assessEngagementIntegrity(candidate.integrity ?? cleanIntegritySignals)): number {
  const ageHours = Math.max(0, (now.getTime() - candidate.createdAt.getTime()) / 3_600_000);
  const interactions = calculateWeightedInteractions(candidate, assessment);
  const reach = Math.max(candidate.viewCount, interactions, 1);
  const engagementRate = interactions / reach;
  const velocity = interactions / Math.sqrt(Math.max(ageHours, 0.5));
  const decay = Math.pow(0.5, ageHours / halfLifeHours);
  return (Math.log1p(interactions) * (1 + 2 * engagementRate) + 0.5 * Math.log1p(velocity) + 0.1) * decay;
}

export function scoreCandidateDeterministically(candidate: RankingCandidate, now: Date, personalized = true, policy: RankingBoostPolicy = defaultBoostPolicy): number {
  const boost = calculateCappedAuthorBoost(candidate.authorTier ?? "none", candidate.authorIsOfficial ?? false, clampBoostPolicyToHardCaps(policy));
  return scoreCandidateQuality(candidate, now) * (personalized && candidate.followedAuthor ? followingMultiplier : 1) * boost;
}

export function explainCandidate(candidate: RankingCandidate, context: RankingContext, boost: number, assessment: IntegrityAssessment): RankingExplanation[] {
  const explanations: RankingExplanation[] = [];
  if (candidate.isPromoted === true) explanations.push({ code: "promoted", label: "Promoted" });
  if (context.personalized && candidate.followedAuthor) explanations.push({ code: "following", label: "You follow this account" });
  const trending = new Set(context.trendingHashtags ?? []);
  const trendingTag = candidate.hashtags?.find((tag) => trending.has(tag));
  if (trendingTag !== undefined) explanations.push({ code: "trending_topic", label: `Trending: #${trendingTag}`, detail: trendingTag });
  const engagementRate = calculateWeightedInteractions(candidate, assessment) / Math.max(candidate.viewCount, 1);
  if (context.viewerCountry != null && candidate.authorCountry === context.viewerCountry && engagementRate > 0.05) explanations.push({ code: "popular_near_you", label: "Popular near you" });
  if (explanations.length === 0 && engagementRate > 0.1) explanations.push({ code: "popular", label: "Popular right now" });
  if (explanations.length === 0 && context.now.getTime() - candidate.createdAt.getTime() < 6 * 3_600_000) explanations.push({ code: "fresh", label: "New post" });
  const trimmed = explanations.slice(0, 3);
  if (boost > 1) {
    const official = candidate.authorIsOfficial === true;
    trimmed.push({ code: official ? "official_boost" : "checkmark_boost", label: official ? "Official account" : "Checkmark account", detail: `Gets a disclosed ranking boost of ${Math.round((boost - 1) * 100)}%, capped for everyone` });
  }
  return trimmed;
}

export function applyAuthorDiversity<T extends { readonly authorId: string }>(ordered: readonly T[]): T[] {
  const pending = [...ordered];
  const placed: T[] = [];
  const countsInWindow = new Map<string, number>();
  while (pending.length > 0) {
    const previousAuthor = placed.at(-1)?.authorId;
    const index = pending.findIndex((item) => {
      const tooMany = placed.length < authorWindowSize && (countsInWindow.get(item.authorId) ?? 0) >= maximumPostsPerAuthorPerPage;
      return item.authorId !== previousAuthor && !tooMany;
    });
    const [next] = pending.splice(index === -1 ? 0 : index, 1);
    if (next === undefined) break;
    countsInWindow.set(next.authorId, (countsInWindow.get(next.authorId) ?? 0) + 1);
    placed.push(next);
  }
  return placed;
}

export function rankCandidatesDeterministically(candidates: readonly RankingCandidate[], context: RankingContext): RankedCandidate[] {
  const policy = clampBoostPolicyToHardCaps(context.boostPolicy ?? defaultBoostPolicy);
  const scored = candidates.map((candidate) => {
    const assessment = assessEngagementIntegrity(candidate.integrity ?? cleanIntegritySignals);
    const boost = calculateCappedAuthorBoost(candidate.authorTier ?? "none", candidate.authorIsOfficial ?? false, policy);
    const score = scoreCandidateQuality(candidate, context.now, assessment) * (context.personalized && candidate.followedAuthor ? followingMultiplier : 1) * boost;
    const ranked: RankedCandidate = { ...candidate, explanations: explainCandidate(candidate, context, boost, assessment), boostMultiplier: boost, trustedEngagementShare: assessment.trustedEngagementShare, manipulated: assessment.manipulated };
    return { ranked, score };
  });
  scored.sort((left, right) => (right.score - left.score !== 0 ? right.score - left.score : right.ranked.postId.localeCompare(left.ranked.postId)));
  return applyAuthorDiversity(scored.map((entry) => entry.ranked));
}

export const deterministicFeedRanker: FeedRanker = {
  async rank(candidates, context) {
    return rankCandidatesDeterministically(candidates, context);
  },
};
