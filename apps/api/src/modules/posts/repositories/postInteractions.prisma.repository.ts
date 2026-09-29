import { isUniqueConstraintViolation } from "../../../databases/prisma.database.js";
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

  public async markCommentDeleted(commentId: string, deletedAt: Date): Promise<boolean> {
    return (await prisma().comment.updateMany({ where: { id: commentId, deletedAt: null }, data: { deletedAt } })).count === 1;
  }

  public async listComments(postId: string, page: PageRequest): Promise<Page<CommentRecord>> {
    const rows = await prisma().comment.findMany({
      where: { postId, deletedAt: null },
      orderBy: [{ createdAt: "asc" }, { id: "asc" }],
      ...buildPrismaPageArguments(page),
    });
    return buildPageFromFetchedRows(rows, page);
  }
}
