import { isUniqueConstraintViolation } from "../../../databases/prisma.database.js";
import { prisma } from "../../../integrations/database.integration.js";
import type { SocialEngagementRepository } from "./socialEngagement.repository.js";

export class PrismaSocialEngagementRepository implements SocialEngagementRepository {
  public async likeComment(commentId: string, userId: string): Promise<boolean> {
    try {
      await prisma().$transaction([
        prisma().commentLike.create({ data: { commentId, userId } }),
        prisma().comment.update({ where: { id: commentId }, data: { likeCount: { increment: 1 } } }),
      ]);
      return true;
    } catch (error) {
      if (isUniqueConstraintViolation(error)) return false;
      throw error;
    }
  }

  public async unlikeComment(commentId: string, userId: string): Promise<boolean> {
    const removed = await prisma().commentLike.deleteMany({ where: { commentId, userId } });
    if (removed.count === 0) return false;
    await prisma().comment.updateMany({ where: { id: commentId, likeCount: { gt: 0 } }, data: { likeCount: { decrement: 1 } } });
    return true;
  }

  public async listCommentIdsLikedByUser(userId: string, commentIds: readonly string[]): Promise<ReadonlySet<string>> {
    const rows = await prisma().commentLike.findMany({ where: { userId, commentId: { in: [...commentIds] } }, select: { commentId: true } });
    return new Set(rows.map((row) => row.commentId));
  }

  public async countLikesForComments(commentIds: readonly string[]): Promise<ReadonlyMap<string, number>> {
    const rows = await prisma().comment.findMany({ where: { id: { in: [...commentIds] } }, select: { id: true, likeCount: true } });
    return new Map(rows.map((row) => [row.id, row.likeCount]));
  }

  public async markStorySeen(storyId: string, userId: string): Promise<void> {
    await prisma().storyView.upsert({ where: { storyId_userId: { storyId, userId } }, create: { storyId, userId }, update: {} });
  }

  public async listStoryIdsSeenByUser(userId: string, storyIds: readonly string[]): Promise<ReadonlySet<string>> {
    const rows = await prisma().storyView.findMany({ where: { userId, storyId: { in: [...storyIds] } }, select: { storyId: true } });
    return new Set(rows.map((row) => row.storyId));
  }
}
