import type { Prisma } from "../../../generated/prisma/client.js";
import type { Db } from "../../../types/database.type.js";
import { shownToViewers } from "../../../constants/moderation.constant.js";

export const postWithMedia = { media: { orderBy: { position: "asc" } } } satisfies Prisma.PostInclude;
export type PostRow = Prisma.PostGetPayload<{ include: typeof postWithMedia }>;

export const postRepository = {
  create: (db: Db, data: Prisma.PostUncheckedCreateInput): Promise<PostRow> => db.post.create({ data, include: postWithMedia }),

  findById: (db: Db, id: string): Promise<PostRow | null> => db.post.findFirst({ where: { id, ...shownToViewers }, include: postWithMedia }),

  findManyByIds: (db: Db, ids: readonly string[]): Promise<PostRow[]> => db.post.findMany({ where: { id: { in: [...ids] }, ...shownToViewers }, include: postWithMedia }),

  findByIdIncludingHidden: (db: Db, id: string): Promise<PostRow | null> => db.post.findFirst({ where: { id }, include: postWithMedia }),

  decrementCounterIfPositive: async (db: Db, id: string, counter: "repostCount" | "quoteCount"): Promise<void> => {
    await db.post.updateMany({ where: { id, [counter]: { gt: 0 } }, data: { [counter]: { decrement: 1 } } });
  },

  findPlainRepost: (db: Db, authorId: string, originalId: string): Promise<PostRow | null> =>
    db.post.findFirst({ where: { authorId, resharedFromId: originalId, isQuote: false, kind: "post", ...shownToViewers }, include: postWithMedia }),

  softDelete: (db: Db, id: string, at: Date) => db.post.update({ where: { id }, data: { deletedAt: at, isPinned: false, pinnedAt: null } }),

  incrementCounterIfNotDeleted: async (db: Db, id: string, counter: "commentCount", by: number): Promise<boolean> =>
    (await db.post.updateMany({ where: { id, deletedAt: null }, data: { [counter]: { increment: by } } })).count === 1,

  decrementQuoteCountsForComments: async (db: Db, commentIds: readonly string[]): Promise<void> => {
    const quoting = await db.comment.findMany({ where: { id: { in: [...commentIds] }, quotedPostId: { not: null } }, select: { quotedPostId: true } });
    for (const row of quoting) if (row.quotedPostId !== null) await db.post.updateMany({ where: { id: row.quotedPostId, quoteCount: { gt: 0 } }, data: { quoteCount: { decrement: 1 } } });
  },

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

  pageByAuthorOrProfile: (db: Db, ownerId: string, kinds: readonly ("post" | "clip" | "story")[], limit: number, cursor: string | undefined, audiences: readonly ("everyone" | "followers")[], now: Date): Promise<PostRow[]> =>
    db.post.findMany({
      where: { AND: [{ OR: [{ authorId: ownerId }, { authorProfileId: ownerId }] }, { ...shownToViewers, kind: { in: [...kinds] }, audience: { in: [...audiences] } }, { OR: [{ expiresAt: null }, { expiresAt: { gt: now } }] }] },
      orderBy: [{ isPinned: "desc" }, { pinnedAt: { sort: "desc", nulls: "last" } }, { id: "desc" }],
      take: limit + 1,
      include: postWithMedia,
      ...(cursor === undefined ? {} : { cursor: { id: cursor }, skip: 1 }),
    }),

  countPinnedByAuthor: (db: Db, authorId: string) => db.post.count({ where: { authorId, isPinned: true, ...shownToViewers, kind: { in: ["post", "clip"] } } }),

  setPinned: (db: Db, id: string, pinnedAt: Date | null): Promise<PostRow> => db.post.update({ where: { id }, data: { isPinned: pinnedAt !== null, pinnedAt }, include: postWithMedia }),

  setPinnedComment: (db: Db, id: string, commentId: string | null) => db.post.update({ where: { id }, data: { pinnedCommentId: commentId } }),

  clearProfilePin: (db: Db, id: string) => db.post.updateMany({ where: { id, isPinned: true }, data: { isPinned: false, pinnedAt: null } }),

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

  repostedOriginalIds: async (db: Db, userId: string, originalIds: readonly string[]): Promise<Set<string>> => {
    if (originalIds.length === 0) return new Set();
    const rows = await db.post.findMany({ where: { authorId: userId, resharedFromId: { in: [...originalIds] }, isQuote: false, kind: "post", ...shownToViewers }, select: { authorId: true, resharedFromId: true, isQuote: true } });
    return new Set(rows.flatMap((row) => (row.authorId === userId && !row.isQuote && row.resharedFromId !== null && originalIds.includes(row.resharedFromId) ? [row.resharedFromId] : [])));
  },

  likedPostIds: async (db: Db, userId: string, postIds: readonly string[]) => {
    const rows = await db.postLike.findMany({ where: { userId, postId: { in: [...postIds] } }, select: { postId: true } });
    return new Set(rows.map((row) => row.postId));
  },

  addLike: async (db: Db, postId: string, userId: string): Promise<boolean> => (await db.postLike.createMany({ data: [{ postId, userId }], skipDuplicates: true })).count === 1,

  removeLike: async (db: Db, postId: string, userId: string): Promise<boolean> => (await db.postLike.deleteMany({ where: { postId, userId } })).count === 1,

  recordShare: (db: Db, postId: string, userId: string, channel: string) => db.postShare.create({ data: { postId, userId, channel } }),

  storyAuthorsWithActiveStories: (db: Db, authorIds: readonly string[], now: Date) =>
    db.post.findMany({ where: { authorId: { in: [...authorIds] }, kind: "story", ...shownToViewers, expiresAt: { gt: now } }, select: { id: true, authorId: true }, orderBy: { id: "desc" } }),

  activeStoryIdsByAuthor: async (db: Db, authorId: string, audiences: readonly ("everyone" | "followers")[], now: Date): Promise<string[]> => {
    const rows = await db.post.findMany({ where: { authorId, kind: "story", ...shownToViewers, audience: { in: [...audiences] }, expiresAt: { gt: now } }, select: { id: true }, orderBy: { id: "asc" }, take: 100 });
    return rows.map((row) => row.id);
  },

  markStoryViewed: (db: Db, storyId: string, viewerId: string) => db.storyView.createMany({ data: [{ storyId, viewerId }], skipDuplicates: true }),

  viewedStoryIds: async (db: Db, viewerId: string, storyIds: readonly string[]) => {
    const rows = await db.storyView.findMany({ where: { viewerId, storyId: { in: [...storyIds] } }, select: { storyId: true } });
    return new Set(rows.map((row) => row.storyId));
  },
};
