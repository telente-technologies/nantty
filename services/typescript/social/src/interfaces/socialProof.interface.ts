export interface SocialProofItem {
  readonly postId: string;
  readonly authorId: string;
  readonly likedByFriendIds: readonly string[];
}

export interface SocialProofSelection {
  readonly postId: string;
  readonly friendIds: readonly string[];
  readonly totalFriendCount: number;
}

export interface SocialProofSelector {
  select(viewerId: string, followedAccountIds: readonly string[], items: readonly SocialProofItem[]): Promise<readonly SocialProofSelection[] | null>;
}
