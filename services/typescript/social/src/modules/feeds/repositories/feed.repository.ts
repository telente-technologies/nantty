import { popularFeedCandidateLimit } from "../../../constants/social.constant.js";
import type { Db } from "../../../types/database.type.js";
import { extractHashtags } from "../../internalSources/services/hashtags.service.js";
import { postWithMedia, type PostRow } from "../../posts/repositories/post.repository.js";
import { publishedPostToViewers } from "../../../constants/moderation.constant.js";

export const feedRepository = {
  pageFollowing: (db: Db, authorIds: readonly string[], kinds: readonly ("post" | "clip")[], limit: number, cursor: string | undefined): Promise<PostRow[]> =>
    db.post.findMany({
      where: { authorId: { in: [...authorIds] }, kind: { in: [...kinds] }, ...publishedPostToViewers, ...(cursor === undefined ? {} : { id: { lt: cursor } }) },
      orderBy: { id: "desc" },
      take: limit + 1,
      include: postWithMedia,
    }),

  popularCandidates: (db: Db, kinds: readonly ("post" | "clip")[], since: Date): Promise<PostRow[]> =>
    db.post.findMany({
      where: { kind: { in: [...kinds] }, ...publishedPostToViewers, moderationVisibility: "visible", audience: "everyone", visibility: "public", createdAt: { gte: since } },
      orderBy: [{ likeCount: "desc" }, { id: "desc" }],
      take: popularFeedCandidateLimit,
      include: postWithMedia,
    }),

  watchTotals: async (db: Db, postIds: readonly string[]): Promise<Map<string, { readonly videoViews: number; readonly completedViews: number }>> => {
    if (postIds.length === 0) return new Map();
    const rows = await db.postDailyStat.groupBy({ by: ["postId"], where: { postId: { in: [...postIds] } }, _sum: { videoViews: true, completedViews: true } });
    return new Map(rows.map((row) => [row.postId, { videoViews: row._sum.videoViews ?? 0, completedViews: row._sum.completedViews ?? 0 }]));
  },

  findRankedRows: (db: Db, ids: readonly string[], kinds: readonly ("post" | "clip")[]): Promise<PostRow[]> =>
    db.post.findMany({ where: { id: { in: [...ids] }, kind: { in: [...kinds] }, ...publishedPostToViewers, moderationVisibility: "visible", audience: "everyone", visibility: "public" }, include: postWithMedia }),

  recordFeedback: (db: Db, userId: string, postId: string, kind: string) => db.feedFeedback.create({ data: { userId, postId, kind } }),

  dismissedPostIds: async (db: Db, userId: string): Promise<Set<string>> => {
    const rows = await db.feedFeedback.findMany({ where: { userId, kind: { in: ["notInterested", "hide"] } }, select: { postId: true }, orderBy: { id: "desc" }, take: 500 });
    return new Set(rows.map((row) => row.postId));
  },

  mutedTopics: async (db: Db, userId: string): Promise<Set<string>> => {
    const feedback = await db.feedFeedback.findMany({ where: { userId, kind: "notInterested" }, select: { postId: true }, orderBy: { id: "desc" }, take: 100 });
    if (feedback.length === 0) return new Set<string>();
    const posts = await db.post.findMany({ where: { id: { in: [...new Set(feedback.map((row) => row.postId))] } }, select: { topics: true, text: true } });
    const muted = new Set<string>();
    for (const post of posts) {
      for (const topic of post.topics) muted.add(topic.toLowerCase());
      for (const tag of extractHashtags(post.text)) muted.add(tag);
    }
    return muted;
  },
};
