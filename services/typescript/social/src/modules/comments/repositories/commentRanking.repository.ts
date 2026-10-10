import { shownToViewers } from "../../../constants/moderation.constant.js";
import type { Db } from "../../../types/database.type.js";
import type { CommentRow } from "./comment.repository.js";

export const rankingCandidateLimit = 1000;
export const previewDescendantsPerRoot = 150;
export const rankSnapshotLifetimeMs = 6 * 3_600_000;

export const commentRankingRepository = {
  rankingCandidates: async (db: Db, postId: string, postAuthorId: string): Promise<CommentRow[]> => {
    const [engaged, byAuthor] = await Promise.all([
      db.comment.findMany({ where: { postId, parentCommentId: null, ...shownToViewers }, orderBy: [{ isPinned: "desc" }, { likeCount: "desc" }, { replyCount: "desc" }, { id: "desc" }], take: rankingCandidateLimit }),
      db.comment.findMany({ where: { postId, parentCommentId: null, authorId: postAuthorId, ...shownToViewers }, orderBy: { id: "desc" }, take: rankingCandidateLimit }),
    ]);
    const unique = new Map<string, CommentRow>();
    for (const row of [...engaged, ...byAuthor]) unique.set(row.id, row);
    return [...unique.values()];
  },

  rootsWithAuthorReplies: async (db: Db, postId: string, postAuthorId: string): Promise<Set<string>> => {
    const rows = await db.comment.findMany({ where: { postId, authorId: postAuthorId, rootCommentId: { not: null }, ...shownToViewers }, select: { rootCommentId: true }, distinct: ["rootCommentId"], take: rankingCandidateLimit * 5 });
    return new Set(rows.flatMap((row) => (row.rootCommentId === null ? [] : [row.rootCommentId])));
  },

  rootsByIds: (db: Db, ids: readonly string[]): Promise<CommentRow[]> =>
    ids.length === 0 ? Promise.resolve([]) : db.comment.findMany({ where: { id: { in: [...ids] }, parentCommentId: null, ...shownToViewers } }),

  tailRoots: (db: Db, postId: string, excludedIds: readonly string[], createdUpTo: Date, afterId: string | null, limit: number): Promise<CommentRow[]> =>
    db.comment.findMany({
      where: { postId, parentCommentId: null, createdAt: { lte: createdUpTo }, id: { notIn: [...excludedIds], ...(afterId === null ? {} : { lt: afterId }) }, ...shownToViewers },
      orderBy: { id: "desc" },
      take: limit + 1,
    }),

  createSnapshot: async (db: Db, data: { readonly postId: string; readonly viewerId: string | undefined; readonly pinnedCommentId: string | null; readonly commentIds: readonly string[]; readonly createdAt: Date }) => {
    await db.commentRankSnapshot.deleteMany({ where: { createdAt: { lt: new Date(data.createdAt.getTime() - rankSnapshotLifetimeMs) } } });
    return db.commentRankSnapshot.create({ data: { postId: data.postId, viewerId: data.viewerId ?? null, pinnedCommentId: data.pinnedCommentId, commentIds: [...data.commentIds], createdAt: data.createdAt } });
  },

  findSnapshot: (db: Db, id: string) => db.commentRankSnapshot.findUnique({ where: { id } }),

  descendantsForRoots: async (db: Db, rootIds: readonly string[], maximumDepth: number): Promise<CommentRow[]> =>
    (await Promise.all(rootIds.map((rootCommentId) =>
      db.comment.findMany({ where: { rootCommentId, depth: { lte: maximumDepth }, ...shownToViewers }, orderBy: [{ depth: "asc" }, { likeCount: "desc" }, { id: "asc" }], take: previewDescendantsPerRoot }),
    ))).flat(),
};
