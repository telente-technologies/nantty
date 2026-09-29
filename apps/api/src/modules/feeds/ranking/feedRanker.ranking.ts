export const RECENCY_HALF_LIFE_HOURS = 24;

export interface RankablePost {
  readonly id: string;
  readonly authorId: string;
  readonly storeId: string | null;
  readonly topics: readonly string[];
  readonly likeCount: number;
  readonly commentCount: number;
  readonly repostCount: number;
  readonly shareCount: number;
  readonly viewCount: number;
  readonly createdAt: Date;
}

export interface FeedRankingContext {
  readonly now: Date;
  readonly followedUserIds: ReadonlySet<string>;
  readonly followedStoreIds: ReadonlySet<string>;
  readonly preferredTopics: ReadonlySet<string>;
  readonly friendLikeCounts: ReadonlyMap<string, number>;
}

export function calculateRecencyDecay(createdAt: Date, now: Date): number {
  const ageHours = Math.max(0, now.getTime() - createdAt.getTime()) / 3_600_000;
  return 0.5 ** (ageHours / RECENCY_HALF_LIFE_HOURS);
}

export function calculateEngagementScore(post: RankablePost): number {
  return Math.log1p(post.likeCount + 2 * post.commentCount + 3 * post.repostCount + 2 * post.shareCount + 0.05 * post.viewCount);
}

export function calculateRelationshipBoost(post: RankablePost, context: FeedRankingContext): number {
  const followsAuthor = context.followedUserIds.has(post.authorId) ? 2 : 0;
  const followsStore = post.storeId !== null && context.followedStoreIds.has(post.storeId) ? 1.5 : 0;
  return followsAuthor + followsStore;
}

export function calculateTopicBoost(post: RankablePost, context: FeedRankingContext): number {
  return Math.min(2, post.topics.filter((topic) => context.preferredTopics.has(topic)).length);
}

export function calculateFriendLikesBoost(post: RankablePost, context: FeedRankingContext): number {
  return Math.min(2, 0.5 * (context.friendLikeCounts.get(post.id) ?? 0));
}

export function scoreFeedPost(post: RankablePost, context: FeedRankingContext): number {
  const relevance =
    1 +
    calculateEngagementScore(post) +
    calculateRelationshipBoost(post, context) +
    calculateTopicBoost(post, context) +
    calculateFriendLikesBoost(post, context);
  return relevance * calculateRecencyDecay(post.createdAt, context.now);
}

export function rankFeedPosts<T extends RankablePost>(posts: readonly T[], context: FeedRankingContext): T[] {
  return posts
    .map((post) => ({ post, score: scoreFeedPost(post, context) }))
    .sort(
      (left, right) =>
        right.score - left.score ||
        right.post.createdAt.getTime() - left.post.createdAt.getTime() ||
        right.post.id.localeCompare(left.post.id),
    )
    .map((entry) => entry.post);
}
