import { maximumThreadLoadSize } from "../../../constants/social.constant.js";
import { shownToViewers } from "../../../constants/moderation.constant.js";
import type { Db } from "../../../types/database.type.js";
import { descendantPathPrefix, threadRootIdOf, type ThreadPlacementSource } from "../services/commentThread.service.js";
import type { CommentRow } from "./comment.repository.js";

const topConversationOrder = [{ isPinned: "desc" }, { likeCount: "desc" }, { replyCount: "desc" }, { id: "desc" }] as const;
const likesConversationOrder = [{ isPinned: "desc" }, { likeCount: "desc" }, { id: "desc" }] as const;
const latestConversationOrder = { isPinned: "desc" as const, id: "desc" as const };

export type ConversationSort = "relevant" | "latest" | "likes";

export const commentThreadRepository = {
  descendantsWithinDepth: (db: Db, focus: ThreadPlacementSource, subtreeRoots: readonly ThreadPlacementSource[], maximumDepth: number): Promise<CommentRow[]> =>
    subtreeRoots.length === 0
      ? Promise.resolve([])
      : db.comment.findMany({
        where: {
          rootCommentId: threadRootIdOf(focus),
          depth: { lte: maximumDepth },
          OR: subtreeRoots.map((root) => ({ path: { startsWith: descendantPathPrefix(root) } })),
          ...shownToViewers,
        },
        orderBy: [{ depth: "asc" }, { id: "asc" }],
        take: maximumThreadLoadSize,
      }),

  allDescendantIds: async (db: Db, comment: ThreadPlacementSource): Promise<string[]> =>
    (await db.comment.findMany({ where: { rootCommentId: threadRootIdOf(comment), path: { startsWith: descendantPathPrefix(comment) }, deletedAt: null }, select: { id: true } })).map((row) => row.id),

  pageConversationRoots: (db: Db, postId: string, sort: ConversationSort, limit: number, offset: number, cursor: string | undefined): Promise<CommentRow[]> =>
    db.comment.findMany({
      where: { postId, parentCommentId: null, ...shownToViewers },
      orderBy: sort === "latest" ? [latestConversationOrder] : sort === "likes" ? [...likesConversationOrder] : [...topConversationOrder],
      take: limit + 1,
      ...(sort === "latest" ? (cursor === undefined ? {} : { cursor: { id: cursor }, skip: 1 }) : { skip: offset }),
    }),

  previewDescendants: (db: Db, roots: readonly ThreadPlacementSource[], maximumDepth: number): Promise<CommentRow[]> =>
    roots.length === 0
      ? Promise.resolve([])
      : db.comment.findMany({ where: { rootCommentId: { in: roots.map((root) => root.id) }, depth: { lte: maximumDepth }, ...shownToViewers }, orderBy: [{ depth: "asc" }, { id: "asc" }], take: maximumThreadLoadSize }),

  ancestors: (db: Db, comment: Pick<ThreadPlacementSource, "path">): Promise<CommentRow[]> => {
    const ancestorIds = comment.path === "" ? [] : comment.path.split("/");
    return ancestorIds.length === 0 ? Promise.resolve([]) : db.comment.findMany({ where: { id: { in: ancestorIds }, ...shownToViewers }, orderBy: { depth: "asc" } });
  },
};
