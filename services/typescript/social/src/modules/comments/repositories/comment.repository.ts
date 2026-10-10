import type { Prisma } from "../../../generated/prisma/client.js";
import type { Db } from "../../../types/database.type.js";
import { shownToViewers } from "../../../constants/moderation.constant.js";

export type CommentRow = Prisma.CommentGetPayload<object>;

export const commentRepository = {
  create: (db: Db, data: Prisma.CommentUncheckedCreateInput): Promise<CommentRow> => db.comment.create({ data }),

  findById: (db: Db, id: string): Promise<CommentRow | null> => db.comment.findFirst({ where: { id, ...shownToViewers } }),

  findManyByIds: (db: Db, ids: readonly string[]): Promise<CommentRow[]> => db.comment.findMany({ where: { id: { in: [...ids] }, ...shownToViewers } }),

  softDeleteMany: (db: Db, ids: readonly string[], at: Date) => db.comment.updateMany({ where: { id: { in: [...ids] }, deletedAt: null }, data: { deletedAt: at } }),

  directChildIds: async (db: Db, parentIds: readonly string[]): Promise<string[]> =>
    (await db.comment.findMany({ where: { parentCommentId: { in: [...parentIds] }, ...shownToViewers }, select: { id: true } })).map((row) => row.id),

  incrementReplies: (db: Db, id: string, by: number) => db.comment.update({ where: { id }, data: { replyCount: { increment: by } } }),

  pageTopLevel: (db: Db, postId: string, limit: number, cursor: string | undefined): Promise<CommentRow[]> =>
    db.comment.findMany({
      where: { postId, parentCommentId: null, ...shownToViewers },
      orderBy: [{ isPinned: "desc" }, { id: "desc" }],
      take: limit + 1,
      ...(cursor === undefined ? {} : { cursor: { id: cursor }, skip: 1 }),
    }),

  pageReplies: (db: Db, parentCommentId: string, limit: number, cursor: string | undefined): Promise<CommentRow[]> =>
    db.comment.findMany({
      where: { parentCommentId, ...shownToViewers },
      orderBy: { id: "asc" },
      take: limit + 1,
      ...(cursor === undefined ? {} : { cursor: { id: cursor }, skip: 1 }),
    }),

  previewRepliesFor: async (db: Db, parentIds: readonly string[], perParent: number): Promise<Map<string, CommentRow[]>> => {
    const grouped = new Map<string, CommentRow[]>();
    await Promise.all(parentIds.map(async (parentId) => {
      grouped.set(parentId, await db.comment.findMany({ where: { parentCommentId: parentId, ...shownToViewers }, orderBy: { id: "asc" }, take: perParent }));
    }));
    return grouped;
  },

  likedCommentIds: async (db: Db, userId: string, commentIds: readonly string[]) => {
    const rows = await db.commentLike.findMany({ where: { userId, commentId: { in: [...commentIds] } }, select: { commentId: true } });
    return new Set(rows.map((row) => row.commentId));
  },

  addLike: async (db: Db, commentId: string, userId: string): Promise<boolean> => (await db.commentLike.createMany({ data: [{ commentId, userId }], skipDuplicates: true })).count === 1,

  removeLike: async (db: Db, commentId: string, userId: string): Promise<boolean> => (await db.commentLike.deleteMany({ where: { commentId, userId } })).count === 1,

  unpinOthersInPost: (db: Db, postId: string, keepCommentId: string) =>
    db.comment.updateMany({ where: { postId, isPinned: true, id: { not: keepCommentId } }, data: { isPinned: false, pinnedAt: null } }),

  setPinned: (db: Db, commentId: string, pinnedAt: Date | null): Promise<CommentRow> => db.comment.update({ where: { id: commentId }, data: { isPinned: pinnedAt !== null, pinnedAt } }),

  clearPins: async (db: Db, commentIds: readonly string[]): Promise<void> => {
    await db.comment.updateMany({ where: { id: { in: [...commentIds] }, isPinned: true }, data: { isPinned: false, pinnedAt: null } });
    await db.post.updateMany({ where: { pinnedCommentId: { in: [...commentIds] } }, data: { pinnedCommentId: null } });
  },

  videoRepliesFor: (db: Db, commentIds: readonly string[]) =>
    db.post.findMany({
      where: { replyToCommentId: { in: [...commentIds] }, kind: "clip", ...shownToViewers },
      select: { id: true, replyToCommentId: true, createdAt: true, media: { select: { posterUrl: true }, orderBy: { position: "asc" }, take: 1 } },
      orderBy: { id: "asc" },
    }),
};
