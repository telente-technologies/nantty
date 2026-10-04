import type { Db } from "../../../types/database.type.js";

export const recentTrendPostSelect = { id: true, authorId: true, text: true, createdAt: true, likeCount: true, commentCount: true, repostCount: true, shareCount: true, viewCount: true, saveCount: true } as const;

export const exploreRepository = {
  recentPublicPosts: (db: Db, since: Date, take: number) =>
    db.post.findMany({
      where: { kind: { in: ["post", "clip"] }, deletedAt: null, moderationVisibility: "visible", audience: "everyone", visibility: "public", createdAt: { gte: since }, sensitiveLabels: { isEmpty: true } },
      select: recentTrendPostSelect,
      orderBy: { createdAt: "desc" },
      take,
    }),

  firstImageForPosts: async (db: Db, postIds: readonly string[]): Promise<string | null> => {
    if (postIds.length === 0) return null;
    const media = await db.postMedia.findFirst({ where: { postId: { in: [...postIds] }, status: "ready", OR: [{ type: "image", url: { not: null } }, { posterUrl: { not: null } }] }, select: { url: true, posterUrl: true, type: true } });
    return media === null ? null : media.type === "image" ? media.url : media.posterUrl;
  },

  followeesOfAccounts: (db: Db, followerIds: readonly string[], take: number) =>
    db.follow.findMany({ where: { followerId: { in: [...followerIds] }, state: "accepted" }, select: { followerId: true, followeeId: true }, orderBy: { id: "desc" }, take }),

  recentFollowTargets: (db: Db, since: Date, take: number) =>
    db.follow.findMany({ where: { state: "accepted", createdAt: { gte: since } }, select: { followeeId: true }, orderBy: { id: "desc" }, take }),

  recentlyLikedAuthors: async (db: Db, userId: string, since: Date, take: number): Promise<string[]> => {
    const rows = await db.postLike.findMany({ where: { userId, createdAt: { gte: since } }, select: { post: { select: { authorId: true } } }, orderBy: { createdAt: "desc" }, take });
    return rows.map((row) => row.post.authorId);
  },
};
