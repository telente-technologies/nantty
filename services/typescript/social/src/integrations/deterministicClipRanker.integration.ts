import type { FeedRanker, RankedCandidate, RankingCandidate, RankingContext } from "../interfaces/feedRanker.interface.js";
import { assessEngagementIntegrity, cleanIntegritySignals } from "../utils/engagementIntegrity.util.js";
import { calculateCappedAuthorBoost, clampBoostPolicyToHardCaps } from "../utils/rankingBoostPolicy.util.js";
import { applyAuthorDiversity, defaultBoostPolicy, explainCandidate, scoreCandidateQuality } from "./deterministicFeedRanker.integration.js";

const completionPrior = 0.35;
const completionPriorWeight = 20;
const followingMultiplier = 1.25;

export function smoothedCompletionRate(candidate: RankingCandidate, trustedShare = 1): number {
  const watches = candidate.videoViews ?? 0;
  const completions = Math.min(candidate.completedViews ?? 0, watches) * trustedShare;
  return (completions + completionPrior * completionPriorWeight) / (watches + completionPriorWeight);
}

export function rankClipsDeterministically(candidates: readonly RankingCandidate[], context: RankingContext): RankedCandidate[] {
  const policy = clampBoostPolicyToHardCaps(context.boostPolicy ?? defaultBoostPolicy);
  const scored = candidates.map((candidate) => {
    const assessment = assessEngagementIntegrity(candidate.integrity ?? cleanIntegritySignals);
    const boost = calculateCappedAuthorBoost(candidate.authorTier ?? "none", candidate.authorIsOfficial ?? false, policy);
    const completion = smoothedCompletionRate(candidate, assessment.trustedEngagementShare);
    const following = context.personalized && candidate.followedAuthor ? followingMultiplier : 1;
    const score = (0.25 + 2 * completion) * scoreCandidateQuality(candidate, context.now, assessment) * following * boost;
    const ranked: RankedCandidate = { ...candidate, explanations: explainCandidate(candidate, context, boost, assessment), boostMultiplier: boost, trustedEngagementShare: assessment.trustedEngagementShare, manipulated: assessment.manipulated };
    return { ranked, score };
  });
  scored.sort((left, right) => (right.score - left.score !== 0 ? right.score - left.score : right.ranked.postId.localeCompare(left.ranked.postId)));
  return applyAuthorDiversity(scored.map((entry) => entry.ranked));
}

export const deterministicClipRanker: FeedRanker = {
  async rank(candidates, context) {
    return rankClipsDeterministically(candidates, context);
  },
};
