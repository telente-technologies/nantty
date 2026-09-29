export interface SocialEngagementRepository {
  likeComment(commentId: string, userId: string): Promise<boolean>;
  unlikeComment(commentId: string, userId: string): Promise<boolean>;
  listCommentIdsLikedByUser(userId: string, commentIds: readonly string[]): Promise<ReadonlySet<string>>;
  countLikesForComments(commentIds: readonly string[]): Promise<ReadonlyMap<string, number>>;
  markStorySeen(storyId: string, userId: string): Promise<void>;
  listStoryIdsSeenByUser(userId: string, storyIds: readonly string[]): Promise<ReadonlySet<string>>;
}

export class InMemorySocialEngagementRepository implements SocialEngagementRepository {
  private readonly commentLikes = new Set<string>();
  private readonly storyViews = new Set<string>();

  public async likeComment(commentId: string, userId: string): Promise<boolean> {
    const key = `${commentId}:${userId}`;
    if (this.commentLikes.has(key)) return false;
    this.commentLikes.add(key);
    return true;
  }

  public async unlikeComment(commentId: string, userId: string): Promise<boolean> {
    return this.commentLikes.delete(`${commentId}:${userId}`);
  }

  public async listCommentIdsLikedByUser(userId: string, commentIds: readonly string[]): Promise<ReadonlySet<string>> {
    return new Set(commentIds.filter((commentId) => this.commentLikes.has(`${commentId}:${userId}`)));
  }

  public async countLikesForComments(commentIds: readonly string[]): Promise<ReadonlyMap<string, number>> {
    const counts = new Map(commentIds.map((commentId) => [commentId, 0]));
    for (const key of this.commentLikes) {
      const commentId = key.slice(0, key.lastIndexOf(":"));
      if (counts.has(commentId)) counts.set(commentId, (counts.get(commentId) ?? 0) + 1);
    }
    return counts;
  }

  public async markStorySeen(storyId: string, userId: string): Promise<void> {
    this.storyViews.add(`${storyId}:${userId}`);
  }

  public async listStoryIdsSeenByUser(userId: string, storyIds: readonly string[]): Promise<ReadonlySet<string>> {
    return new Set(storyIds.filter((storyId) => this.storyViews.has(`${storyId}:${userId}`)));
  }
}
