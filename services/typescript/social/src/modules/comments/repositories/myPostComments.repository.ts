import { shownToViewers } from "../../../constants/moderation.constant.js";
import type { Prisma } from "../../../generated/prisma/client.js";
import type { Db } from "../../../types/database.type.js";
import type { MyPostCommentsFilter } from "../models/myPostComments.model.js";
import type { CommentRow } from "./comment.repository.js";

export interface MyPostCommentsPageInput {
  readonly ownerId: string;
  readonly filter: MyPostCommentsFilter;
  readonly postId: string | undefined;
  readonly search: string | undefined;
  readonly cursor: string | undefined;
  readonly limit: number;
}

function filterClause(ownerId: string, filter: MyPostCommentsFilter): Prisma.CommentWhereInput {
  if (filter === "hidden") return { hiddenAt: { not: null } };
  if (filter === "pinned") return { isPinned: true, hiddenAt: null };
  if (filter === "needs_reply") return { parentCommentId: null, hiddenAt: null, authorId: { not: ownerId }, replies: { none: { authorId: ownerId, deletedAt: null } } };
  return { parentCommentId: null, hiddenAt: null };
}

export const myPostCommentsRepository = {
  page: (db: Db, input: MyPostCommentsPageInput): Promise<CommentRow[]> =>
    db.comment.findMany({
      where: {
        ...shownToViewers,
        post: { authorId: input.ownerId, deletedAt: null },
        ...(input.postId === undefined ? {} : { postId: input.postId }),
        ...(input.search === undefined ? {} : { text: { contains: input.search, mode: "insensitive" } }),
        ...(input.cursor === undefined ? {} : { id: { lt: input.cursor } }),
        ...filterClause(input.ownerId, input.filter),
      },
      orderBy: { id: "desc" },
      take: input.limit + 1,
    }),

  parentsRepliedBy: async (db: Db, ownerId: string, parentIds: readonly string[]): Promise<Set<string>> => {
    if (parentIds.length === 0) return new Set();
    const rows = await db.comment.findMany({ where: { parentCommentId: { in: [...parentIds] }, authorId: ownerId, deletedAt: null }, select: { parentCommentId: true } });
    return new Set(rows.flatMap((row) => (row.parentCommentId === null ? [] : [row.parentCommentId])));
  },

  postSummaries: (db: Db, postIds: readonly string[]) =>
    postIds.length === 0
      ? Promise.resolve([])
      : db.post.findMany({ where: { id: { in: [...postIds] } }, select: { id: true, kind: true, text: true, media: { select: { type: true, url: true, posterUrl: true }, orderBy: { position: "asc" }, take: 1 } } }),
};
