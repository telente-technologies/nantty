import type { FeedRanker, RankingCandidate } from "../interfaces/feedRanker.interface.js";

const halfLifeHours = 18;

export function scoreCandidateDeterministically(candidate: RankingCandidate, now: Date): number {
  const ageHours = Math.max(0, (now.getTime() - candidate.createdAt.getTime()) / 3_600_000);
  const engagement = candidate.likeCount + candidate.commentCount * 3 + candidate.repostCount * 4 + candidate.shareCount * 4 + Math.sqrt(candidate.viewCount);
  const decay = Math.pow(0.5, ageHours / halfLifeHours);
  return (Math.log1p(engagement) + (candidate.followedAuthor ? 1.5 : 0)) * decay;
}

export const deterministicFeedRanker: FeedRanker = {
  async rank(candidates, context) {
    return [...candidates].sort((left, right) => {
      const difference = scoreCandidateDeterministically(right, context.now) - scoreCandidateDeterministically(left, context.now);
      return difference !== 0 ? difference : right.postId.localeCompare(left.postId);
    });
  },
};
