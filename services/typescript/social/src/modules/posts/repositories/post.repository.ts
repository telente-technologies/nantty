import type { Prisma } from "../../../generated/prisma/client.js";
import type { Db } from "../../../types/database.type.js";
import { shownToViewers } from "../../../constants/moderation.constant.js";

export const postWithMedia = { media: { orderBy: { position: "asc" } } } satisfies Prisma.PostInclude;
export type PostRow = Prisma.PostGetPayload<{ include: typeof postWithMedia }>;

export const postRepository = {
  create: (db: Db, data: Prisma.PostUncheckedCreateInput): Promise<PostRow> => db.post.create({ data, include: postWithMedia }),

  findById: (db: Db, id: string): Promise<PostRow | null> => db.post.findFirst({ where: { id, ...shownToViewers }, include: postWithMedia }),

  findManyByIds: (db: Db, ids: readonly string[]): Promise<PostRow[]> => db.post.findMany({ where: { id: { in: [...ids] }, ...shownToViewers }, include: postWithMedia }),

  softDelete: (db: Db, id: string, at: Date) => db.post.update({ where: { id }, data: { deletedAt: at } }),

  incrementCounterIfNotDeleted: async (db: Db, id: string, counter: "commentCount", by: number): Promise<boolean> =>
    (await db.post.updateMany({ where: { id, deletedAt: null }, data: { [counter]: { increment: by } } })).count === 1,

  incrementCounter: (db: Db, id: string, counter: "likeCount" | "commentCount" | "repostCount" | "shareCount" | "viewCount" | "quoteCount", by: number) =>
    db.post.update({ where: { id }, data: { [counter]: { increment: by } } }),

  pageByAuthor: (db: Db, authorId: string, kinds: readonly ("post" | "clip" | "story")[], limit: number, cursor: string | undefined, audiences: readonly ("everyone" | "followers")[], now: Date): Promise<PostRow[]> =>
    db.post.findMany({
      where: { authorId, ...shownToViewers, kind: { in: [...kinds] }, audience: { in: [...audiences] }, OR: [{ expiresAt: null }, { expiresAt: { gt: now } }] },
      orderBy: { id: "desc" },
      take: limit + 1,
      include: postWithMedia,
      ...(cursor === undefined ? {} : { cursor: { id: cursor }, skip: 1 }),
    }),

  updateReplyPolicy: (db: Db, id: string, replyPolicy: "everyone" | "following" | "followers" | "mentioned" | "off"): Promise<PostRow> =>
    db.post.update({ where: { id }, data: { replyPolicy }, include: postWithMedia }),

  pageQuotesOf: (db: Db, originalId: string, limit: number, cursor: string | undefined, extraWhere: Prisma.PostWhereInput): Promise<PostRow[]> =>
    db.post.findMany({
      where: { resharedFromId: originalId, isQuote: true, ...shownToViewers, ...extraWhere },
      orderBy: { id: "desc" },
      take: limit + 1,
      include: postWithMedia,
      ...(cursor === undefined ? {} : { cursor: { id: cursor }, skip: 1 }),
    }),

  countByAuthor: (db: Db, authorId: string) => db.post.count({ where: { authorId, ...shownToViewers, kind: { in: ["post", "clip"] } } }),

  likedPostIds: async (db: Db, userId: string, postIds: readonly string[]) => {
    const rows = await db.postLike.findMany({ where: { userId, postId: { in: [...postIds] } }, select: { postId: true } });
    return new Set(rows.map((row) => row.postId));
  },

  addLike: async (db: Db, postId: string, userId: string): Promise<boolean> => (await db.postLike.createMany({ data: [{ postId, userId }], skipDuplicates: true })).count === 1,

  removeLike: async (db: Db, postId: string, userId: string): Promise<boolean> => (await db.postLike.deleteMany({ where: { postId, userId } })).count === 1,

  recordShare: (db: Db, postId: string, userId: string, channel: string) => db.postShare.create({ data: { postId, userId, channel } }),

  storyAuthorsWithActiveStories: (db: Db, authorIds: readonly string[], now: Date) =>
    db.post.findMany({ where: { authorId: { in: [...authorIds] }, kind: "story", ...shownToViewers, expiresAt: { gt: now } }, select: { id: true, authorId: true }, orderBy: { id: "desc" } }),

  markStoryViewed: (db: Db, storyId: string, viewerId: string) => db.storyView.createMany({ data: [{ storyId, viewerId }], skipDuplicates: true }),

  viewedStoryIds: async (db: Db, viewerId: string, storyIds: readonly string[]) => {
    const rows = await db.storyView.findMany({ where: { viewerId, storyId: { in: [...storyIds] } }, select: { storyId: true } });
    return new Set(rows.map((row) => row.storyId));
  },
};
