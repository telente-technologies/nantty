export interface RankingCandidate {
  readonly postId: string;
  readonly authorId: string;
  readonly createdAt: Date;
  readonly likeCount: number;
  readonly commentCount: number;
  readonly repostCount: number;
  readonly shareCount: number;
  readonly viewCount: number;
  readonly followedAuthor: boolean;
}

export interface RankingContext {
  readonly viewerId: string | null;
  readonly personalized: boolean;
  readonly now: Date;
}

export interface FeedRanker {
  rank(candidates: readonly RankingCandidate[], context: RankingContext): Promise<readonly RankingCandidate[]>;
}
