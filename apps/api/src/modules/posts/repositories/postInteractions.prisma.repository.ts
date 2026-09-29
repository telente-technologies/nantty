import { isUniqueConstraintViolation } from "../../../databases/prisma.database.js";
import type { Prisma } from "../../../generated/prisma/client.js";
import { prisma } from "../../../integrations/database.integration.js";
import type { Page, PageRequest } from "../../../types/pagination.type.js";
import { buildPageFromFetchedRows, buildPrismaPageArguments } from "../../../utils/pagination.util.js";
import type { CommentRecord } from "../models/posts.model.js";
import type { NewCommentInput, PostInteractionsRepository } from "./postInteractions.repository.js";

export class PrismaPostInteractionsRepository implements PostInteractionsRepository {
  public async addLike(postId: string, userId: string, createdAt: Date): Promise<boolean> {
    try {
      await prisma().postLike.create({ data: { postId, userId, createdAt } });
      return true;
    } catch (error) {
      if (isUniqueConstraintViolation(error)) return false;
      throw error;
    }
  }

  public async removeLike(postId: string, userId: string): Promise<boolean> {
    return (await prisma().postLike.deleteMany({ where: { postId, userId } })).count > 0;
  }

  public async listPostIdsLikedByUser(userId: string, postIds: readonly string[]): Promise<ReadonlySet<string>> {
    const rows = await prisma().postLike.findMany({ where: { userId, postId: { in: [...postIds] } }, select: { postId: true } });
    return new Set(rows.map((row) => row.postId));
  }

  public async listLikersAmongUsers(postIds: readonly string[], userIds: readonly string[]): Promise<ReadonlyMap<string, readonly string[]>> {
    const rows = await prisma().postLike.findMany({
      where: { postId: { in: [...postIds] }, userId: { in: [...userIds] } },
      select: { postId: true, userId: true },
    });
    const grouped = new Map<string, string[]>();
    for (const row of rows) grouped.set(row.postId, [...(grouped.get(row.postId) ?? []), row.userId]);
    return grouped;
  }

  public async createComment(input: NewCommentInput): Promise<CommentRecord> {
    return prisma().comment.create({ data: { ...input } });
  }

  public async findComment(commentId: string): Promise<CommentRecord | undefined> {
    return (await prisma().comment.findUnique({ where: { id: commentId } })) ?? undefined;
  }

  public async findCommentsByIds(commentIds: readonly string[]): Promise<readonly CommentRecord[]> {
    if (commentIds.length === 0) return [];
    return prisma().comment.findMany({ where: { id: { in: [...new Set(commentIds)] } } });
  }

  public async markCommentDeleted(commentId: string, deletedAt: Date): Promise<boolean> {
    return (await prisma().comment.updateMany({ where: { id: commentId, deletedAt: null }, data: { deletedAt } })).count === 1;
  }

  public async changeReplyCount(commentIds: readonly string[], delta: number): Promise<void> {
    const ids = [...new Set(commentIds)];
    if (ids.length === 0) return;
    if (delta >= 0) {
      await prisma().comment.updateMany({ where: { id: { in: ids } }, data: { replyCount: { increment: delta } } });
      return;
    }
    await prisma().comment.updateMany({ where: { id: { in: ids }, replyCount: { gte: -delta } }, data: { replyCount: { decrement: -delta } } });
  }

  public listTopLevelComments(postId: string, page: PageRequest): Promise<Page<CommentRecord>> {
    return this.paginateShownComments({ postId, parentCommentId: null }, page);
  }

  public listThreadReplies(rootCommentId: string, page: PageRequest): Promise<Page<CommentRecord>> {
    return this.paginateShownComments({ rootCommentId }, page);
  }

  public listDirectReplies(parentCommentId: string, page: PageRequest): Promise<Page<CommentRecord>> {
    return this.paginateShownComments({ parentCommentId }, page);
  }

  public async listEarliestThreadReplies(rootCommentIds: readonly string[], limitPerThread: number): Promise<ReadonlyMap<string, readonly CommentRecord[]>> {
    const unique = [...new Set(rootCommentIds)];
    const previews = await Promise.all(unique.map(async (rootCommentId) => [rootCommentId, (await this.listThreadReplies(rootCommentId, { limit: limitPerThread })).data] as const));
    return new Map(previews);
  }

  private async paginateShownComments(where: Prisma.CommentWhereInput, page: PageRequest): Promise<Page<CommentRecord>> {
    const rows = await prisma().comment.findMany({
      where: { ...where, OR: [{ deletedAt: null }, { replyCount: { gt: 0 } }] },
      orderBy: [{ createdAt: "asc" }, { id: "asc" }],
      ...buildPrismaPageArguments(page),
    });
    return buildPageFromFetchedRows(rows, page);
  }
}
