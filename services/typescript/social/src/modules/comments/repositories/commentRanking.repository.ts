import type { Db } from "../../../types/database.type.js";
import { visibleTo, type CommentRow } from "./comment.repository.js";

export const rankingCandidateLimit = 1000;
export const previewDescendantsPerRoot = 150;
export const rankSnapshotLifetimeMs = 6 * 3_600_000;
export const rankSnapshotReuseMs = 60_000;

export const commentRankingRepository = {
  rankingCandidates: async (db: Db, postId: string, postAuthorId: string, viewerId: string | undefined): Promise<CommentRow[]> => {
    const [engaged, byAuthor] = await Promise.all([
      db.comment.findMany({ where: { postId, parentCommentId: null, ...visibleTo(viewerId) }, orderBy: [{ isPinned: "desc" }, { likeCount: "desc" }, { replyCount: "desc" }, { id: "desc" }], take: rankingCandidateLimit }),
      db.comment.findMany({ where: { postId, parentCommentId: null, authorId: postAuthorId, ...visibleTo(viewerId) }, orderBy: { id: "desc" }, take: rankingCandidateLimit }),
    ]);
    const unique = new Map<string, CommentRow>();
    for (const row of [...engaged, ...byAuthor]) unique.set(row.id, row);
    return [...unique.values()];
  },

  rootsWithAuthorReplies: async (db: Db, postId: string, postAuthorId: string): Promise<Set<string>> => {
    const rows = await db.comment.findMany({ where: { postId, authorId: postAuthorId, rootCommentId: { not: null }, ...visibleTo() }, select: { rootCommentId: true }, distinct: ["rootCommentId"], take: rankingCandidateLimit * 5 });
    return new Set(rows.flatMap((row) => (row.rootCommentId === null ? [] : [row.rootCommentId])));
  },

  rootsByIds: (db: Db, ids: readonly string[], viewerId: string | undefined): Promise<CommentRow[]> =>
    ids.length === 0 ? Promise.resolve([]) : db.comment.findMany({ where: { id: { in: [...ids] }, parentCommentId: null, ...visibleTo(viewerId) } }),

  tailRoots: (db: Db, postId: string, viewerId: string | undefined, excludedIds: readonly string[], createdUpTo: Date, afterId: string | null, limit: number): Promise<CommentRow[]> =>
    db.comment.findMany({
      where: { postId, parentCommentId: null, createdAt: { lte: createdUpTo }, id: { notIn: [...excludedIds], ...(afterId === null ? {} : { lt: afterId }) }, ...visibleTo(viewerId) },
      orderBy: { id: "desc" },
      take: limit + 1,
    }),

  createSnapshot: async (db: Db, data: { readonly postId: string; readonly viewerId: string | undefined; readonly pinnedCommentId: string | null; readonly commentIds: readonly string[]; readonly createdAt: Date }) => {
    await db.commentRankSnapshot.deleteMany({ where: { createdAt: { lt: new Date(data.createdAt.getTime() - rankSnapshotLifetimeMs) } } });
    return db.commentRankSnapshot.create({ data: { postId: data.postId, viewerId: data.viewerId ?? null, pinnedCommentId: data.pinnedCommentId, commentIds: [...data.commentIds], createdAt: data.createdAt } });
  },

  findSnapshot: (db: Db, id: string) => db.commentRankSnapshot.findUnique({ where: { id } }),

  findReusableSnapshot: (db: Db, postId: string, viewerId: string | undefined, createdSince: Date) =>
    db.commentRankSnapshot.findFirst({ where: { postId, viewerId: viewerId ?? null, createdAt: { gt: createdSince } }, orderBy: { createdAt: "desc" } }),

  countRootsUpTo: (db: Db, postId: string, viewerId: string | undefined, createdUpTo: Date): Promise<number> =>
    db.comment.count({ where: { postId, parentCommentId: null, createdAt: { lte: createdUpTo }, ...visibleTo(viewerId) } }),

  descendantsForRoots: async (db: Db, rootIds: readonly string[], viewerId: string | undefined, maximumDepth: number): Promise<CommentRow[]> =>
    (await Promise.all(rootIds.map((rootCommentId) =>
      db.comment.findMany({ where: { rootCommentId, depth: { lte: maximumDepth }, ...visibleTo(viewerId) }, orderBy: [{ depth: "asc" }, { likeCount: "desc" }, { id: "asc" }], take: previewDescendantsPerRoot }),
    ))).flat(),
};
