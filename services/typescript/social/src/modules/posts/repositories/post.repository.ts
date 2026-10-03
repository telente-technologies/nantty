import type { Prisma } from "../../../generated/prisma/client.js";
import type { Db } from "../../../types/database.type.js";

export const postWithMedia = { media: { orderBy: { position: "asc" } } } satisfies Prisma.PostInclude;
export type PostRow = Prisma.PostGetPayload<{ include: typeof postWithMedia }>;

export const postRepository = {
  create: (db: Db, data: Prisma.PostUncheckedCreateInput): Promise<PostRow> => db.post.create({ data, include: postWithMedia }),

  findById: (db: Db, id: string): Promise<PostRow | null> => db.post.findFirst({ where: { id, deletedAt: null }, include: postWithMedia }),

  findManyByIds: (db: Db, ids: readonly string[]): Promise<PostRow[]> => db.post.findMany({ where: { id: { in: [...ids] }, deletedAt: null }, include: postWithMedia }),

  softDelete: (db: Db, id: string, at: Date) => db.post.update({ where: { id }, data: { deletedAt: at } }),

  incrementCounter: (db: Db, id: string, counter: "likeCount" | "commentCount" | "repostCount" | "shareCount" | "viewCount", by: number) =>
    db.post.update({ where: { id }, data: { [counter]: { increment: by } } }),

  pageByAuthor: (db: Db, authorId: string, kinds: readonly ("post" | "clip" | "story")[], limit: number, cursor: string | undefined, audiences: readonly ("everyone" | "followers")[], now: Date): Promise<PostRow[]> =>
    db.post.findMany({
      where: { authorId, deletedAt: null, kind: { in: [...kinds] }, audience: { in: [...audiences] }, OR: [{ expiresAt: null }, { expiresAt: { gt: now } }] },
      orderBy: { id: "desc" },
      take: limit + 1,
      include: postWithMedia,
      ...(cursor === undefined ? {} : { cursor: { id: cursor }, skip: 1 }),
    }),

  countByAuthor: (db: Db, authorId: string) => db.post.count({ where: { authorId, deletedAt: null, kind: { in: ["post", "clip"] } } }),

  likedPostIds: async (db: Db, userId: string, postIds: readonly string[]) => {
    const rows = await db.postLike.findMany({ where: { userId, postId: { in: [...postIds] } }, select: { postId: true } });
    return new Set(rows.map((row) => row.postId));
  },

  addLike: async (db: Db, postId: string, userId: string): Promise<boolean> => (await db.postLike.createMany({ data: [{ postId, userId }], skipDuplicates: true })).count === 1,

  removeLike: async (db: Db, postId: string, userId: string): Promise<boolean> => (await db.postLike.deleteMany({ where: { postId, userId } })).count === 1,

  recordShare: (db: Db, postId: string, userId: string, channel: string) => db.postShare.create({ data: { postId, userId, channel } }),

  storyAuthorsWithActiveStories: (db: Db, authorIds: readonly string[], now: Date) =>
    db.post.findMany({ where: { authorId: { in: [...authorIds] }, kind: "story", deletedAt: null, expiresAt: { gt: now } }, select: { id: true, authorId: true }, orderBy: { id: "desc" } }),

  markStoryViewed: (db: Db, storyId: string, viewerId: string) => db.storyView.createMany({ data: [{ storyId, viewerId }], skipDuplicates: true }),

  viewedStoryIds: async (db: Db, viewerId: string, storyIds: readonly string[]) => {
    const rows = await db.storyView.findMany({ where: { viewerId, storyId: { in: [...storyIds] } }, select: { storyId: true } });
    return new Set(rows.map((row) => row.storyId));
  },
};
