import type { FollowState, PostNotificationLevel } from "../../../generated/prisma/client.js";
import type { Db } from "../../../types/database.type.js";

export const followRepository = {
  find: (db: Db, followerId: string, followeeId: string) => db.follow.findUnique({ where: { followerId_followeeId: { followerId, followeeId } } }),

  findById: (db: Db, id: string) => db.follow.findUnique({ where: { id } }),

  claimFollowState: async (db: Db, existingId: string | undefined, followerId: string, followeeId: string, state: "requested" | "accepted", now: Date): Promise<boolean> => {
    const respondedAt = state === "accepted" ? now : null;
    if (existingId === undefined) return (await db.follow.createMany({ data: [{ followerId, followeeId, state, respondedAt }], skipDuplicates: true })).count === 1;
    return (await db.follow.updateMany({ where: { id: existingId, state: "rejected" }, data: { state, createdAt: now, respondedAt, endedBy: null, postNotifications: "off" } })).count === 1;
  },

  setPostNotifications: (db: Db, id: string, level: PostNotificationLevel) => db.follow.update({ where: { id }, data: { postNotifications: level } }),

  pagePostNotificationSubscribers: (db: Db, followeeId: string, levels: readonly PostNotificationLevel[], limit: number, cursor: string | undefined) =>
    db.follow.findMany({
      where: { followeeId, state: "accepted", postNotifications: { in: [...levels] }, ...(cursor === undefined ? {} : { id: { gt: cursor } }) },
      orderBy: { id: "asc" },
      take: limit + 1,
      select: { id: true, followerId: true },
    }),

  setState: (db: Db, id: string, state: FollowState, respondedAt: Date) => db.follow.update({ where: { id }, data: { state, respondedAt } }),

  settlePendingRequest: async (db: Db, id: string, state: "accepted" | "rejected", respondedAt: Date, endedBy: "requester" | "owner" | null = null) =>
    (await db.follow.updateMany({ where: { id, state: "requested" }, data: { state, respondedAt, endedBy } })).count === 1,

  pagePendingRequestsOf: (db: Db, followeeId: string, limit: number) =>
    db.follow.findMany({ where: { followeeId, state: "requested" }, orderBy: { id: "asc" }, take: limit, select: { id: true, followerId: true } }),

  delete: (db: Db, followerId: string, followeeId: string) => db.follow.deleteMany({ where: { followerId, followeeId } }),

  deleteBothDirections: (db: Db, accountA: string, accountB: string) =>
    db.follow.deleteMany({ where: { OR: [{ followerId: accountA, followeeId: accountB }, { followerId: accountB, followeeId: accountA }] } }),

  statesFromFollower: async (db: Db, followerId: string, followeeIds: readonly string[]) => {
    const rows = await db.follow.findMany({ where: { followerId, followeeId: { in: [...followeeIds] } }, select: { followeeId: true, state: true } });
    return new Map(rows.map((row) => [row.followeeId, row.state]));
  },

  acceptedFolloweeIds: async (db: Db, followerId: string) => {
    const rows = await db.follow.findMany({ where: { followerId, state: "accepted" }, select: { followeeId: true } });
    return new Set(rows.map((row) => row.followeeId));
  },

  acceptedFollowersFromAccounts: async (db: Db, followerIds: readonly string[], followeeIds: readonly string[]) => {
    if (followerIds.length === 0 || followeeIds.length === 0) return [];
    return db.follow.findMany({
      where: { followerId: { in: [...followerIds] }, followeeId: { in: [...followeeIds] }, state: "accepted" },
      select: { followerId: true, followeeId: true },
    });
  },

  acceptedFollowersOf: async (db: Db, followeeId: string, followerIds: readonly string[]) => {
    if (followerIds.length === 0) return new Set<string>();
    const rows = await db.follow.findMany({ where: { followeeId, followerId: { in: [...followerIds] }, state: "accepted" }, select: { followerId: true } });
    return new Set(rows.map((row) => row.followerId));
  },

  followedAccountIds: async (db: Db, followerId: string, candidateIds: readonly string[]) => {
    const rows = await db.follow.findMany({ where: { followerId, state: "accepted", followeeId: { in: [...candidateIds] } }, select: { followeeId: true } });
    return new Set(rows.map((row) => row.followeeId));
  },

  allFollowedAccountIds: async (db: Db, followerId: string, limit = 5000) => {
    const rows = await db.follow.findMany({ where: { followerId, state: "accepted" }, select: { followeeId: true }, orderBy: { id: "desc" }, take: limit });
    return rows.map((row) => row.followeeId);
  },

  allPendingFollowRequestAccountIds: async (db: Db, followerId: string, limit = 2000) => {
    const rows = await db.follow.findMany({ where: { followerId, state: "requested" }, select: { followeeId: true }, orderBy: { id: "desc" }, take: limit });
    return rows.map((row) => row.followeeId);
  },

  countFollowers: (db: Db, accountId: string) => db.follow.count({ where: { followeeId: accountId, state: "accepted" } }),
  countFollowing: (db: Db, accountId: string) => db.follow.count({ where: { followerId: accountId, state: "accepted" } }),

  pageFollowers: (db: Db, ownerId: string, limit: number, cursor: string | undefined, followerIdFilter: readonly string[] | undefined) =>
    db.follow.findMany({
      where: { followeeId: ownerId, state: "accepted", ...(followerIdFilter === undefined ? {} : { followerId: { in: [...followerIdFilter] } }) },
      orderBy: { id: "desc" },
      take: limit + 1,
      ...(cursor === undefined ? {} : { cursor: { id: cursor }, skip: 1 }),
    }),

  pageFollowing: (db: Db, ownerId: string, limit: number, cursor: string | undefined, followeeIdFilter: readonly string[] | undefined) =>
    db.follow.findMany({
      where: { followerId: ownerId, state: "accepted", ...(followeeIdFilter === undefined ? {} : { followeeId: { in: [...followeeIdFilter] } }) },
      orderBy: { id: "desc" },
      take: limit + 1,
      ...(cursor === undefined ? {} : { cursor: { id: cursor }, skip: 1 }),
    }),

  pageIncomingRequests: (db: Db, followeeId: string, limit: number, cursor: string | undefined) =>
    db.follow.findMany({
      where: { followeeId, state: "requested" },
      orderBy: { id: "desc" },
      take: limit + 1,
      ...(cursor === undefined ? {} : { cursor: { id: cursor }, skip: 1 }),
    }),
};
