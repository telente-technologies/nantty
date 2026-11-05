import type { Db } from "../../../types/database.type.js";

export const storeFollowRepository = {
  follow: async (db: Db, followerId: string, storeId: string, at: Date): Promise<boolean> =>
    (await db.storeFollow.createMany({ data: [{ followerId, storeId, createdAt: at }], skipDuplicates: true })).count === 1,

  unfollow: async (db: Db, followerId: string, storeId: string): Promise<boolean> => (await db.storeFollow.deleteMany({ where: { followerId, storeId } })).count > 0,

  isFollowing: async (db: Db, followerId: string, storeId: string): Promise<boolean> => (await db.storeFollow.findUnique({ where: { followerId_storeId: { followerId, storeId } } })) !== null,

  countFollowers: (db: Db, storeId: string): Promise<number> => db.storeFollow.count({ where: { storeId } }),

  pageFollowers: (db: Db, storeId: string, limit: number, cursorFollowerId: string | undefined) =>
    db.storeFollow.findMany({
      where: { storeId },
      orderBy: [{ createdAt: "desc" }, { followerId: "desc" }],
      take: limit + 1,
      ...(cursorFollowerId === undefined ? {} : { cursor: { followerId_storeId: { followerId: cursorFollowerId, storeId } }, skip: 1 }),
    }),

  pageFollowedStores: (db: Db, followerId: string, limit: number, cursorStoreId: string | undefined) =>
    db.storeFollow.findMany({
      where: { followerId },
      orderBy: [{ createdAt: "desc" }, { storeId: "desc" }],
      take: limit + 1,
      ...(cursorStoreId === undefined ? {} : { cursor: { followerId_storeId: { followerId, storeId: cursorStoreId } }, skip: 1 }),
    }),
};
