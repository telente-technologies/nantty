import { popularFeedCandidateLimit } from "../../../constants/social.constant.js";
import type { Db } from "../../../types/database.type.js";
import { postWithMedia, type PostRow } from "../../posts/repositories/post.repository.js";

export const feedRepository = {
  pageFollowing: (db: Db, authorIds: readonly string[], kinds: readonly ("post" | "clip")[], limit: number, cursor: string | undefined): Promise<PostRow[]> =>
    db.post.findMany({
      where: { authorId: { in: [...authorIds] }, kind: { in: [...kinds] }, deletedAt: null },
      orderBy: { id: "desc" },
      take: limit + 1,
      include: postWithMedia,
      ...(cursor === undefined ? {} : { cursor: { id: cursor }, skip: 1 }),
    }),

  popularCandidates: (db: Db, kinds: readonly ("post" | "clip")[], since: Date): Promise<PostRow[]> =>
    db.post.findMany({
      where: { kind: { in: [...kinds] }, deletedAt: null, audience: "everyone", visibility: "public", createdAt: { gte: since } },
      orderBy: [{ likeCount: "desc" }, { id: "desc" }],
      take: popularFeedCandidateLimit,
      include: postWithMedia,
    }),

  recordFeedback: (db: Db, userId: string, postId: string, kind: string) => db.feedFeedback.create({ data: { userId, postId, kind } }),

  dismissedPostIds: async (db: Db, userId: string): Promise<Set<string>> => {
    const rows = await db.feedFeedback.findMany({ where: { userId, kind: { in: ["notInterested", "hide"] } }, select: { postId: true }, orderBy: { id: "desc" }, take: 500 });
    return new Set(rows.map((row) => row.postId));
  },
};
