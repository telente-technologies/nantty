import type { Db } from "../../../types/database.type.js";

export const blockRepository = {
  create: (db: Db, blockerId: string, blockedId: string) =>
    db.block.upsert({ where: { blockerId_blockedId: { blockerId, blockedId } }, create: { blockerId, blockedId }, update: {} }),

  createIfMissing: async (db: Db, blockerId: string, blockedId: string) =>
    (await db.block.createMany({ data: [{ blockerId, blockedId }], skipDuplicates: true })).count === 1,

  delete: (db: Db, blockerId: string, blockedId: string) => db.block.deleteMany({ where: { blockerId, blockedId } }),

  exists: async (db: Db, blockerId: string, blockedId: string) =>
    (await db.block.findUnique({ where: { blockerId_blockedId: { blockerId, blockedId } }, select: { blockerId: true } })) !== null,

  eitherDirection: async (db: Db, accountA: string, accountB: string) =>
    (await db.block.count({ where: { OR: [{ blockerId: accountA, blockedId: accountB }, { blockerId: accountB, blockedId: accountA }] } })) > 0,

  hasBlockedPairWithAny: async (db: Db, accountId: string, candidateIds: readonly string[]) => {
    if (candidateIds.length === 0) return false;
    return (await db.block.count({
      where: { OR: [{ blockerId: accountId, blockedId: { in: [...candidateIds] } }, { blockedId: accountId, blockerId: { in: [...candidateIds] } }] },
    })) > 0;
  },

  blockedByViewer: async (db: Db, viewerId: string, candidateIds: readonly string[]) => {
    const rows = await db.block.findMany({ where: { blockerId: viewerId, blockedId: { in: [...candidateIds] } }, select: { blockedId: true } });
    return new Set(rows.map((row) => row.blockedId));
  },

  blockersOfViewer: async (db: Db, viewerId: string, candidateIds: readonly string[]) => {
    const rows = await db.block.findMany({ where: { blockedId: viewerId, blockerId: { in: [...candidateIds] } }, select: { blockerId: true } });
    return new Set(rows.map((row) => row.blockerId));
  },

  everyoneBlockedByOrBlocking: async (db: Db, accountId: string) => {
    const rows = await db.block.findMany({ where: { OR: [{ blockerId: accountId }, { blockedId: accountId }] }, select: { blockerId: true, blockedId: true } });
    return new Set(rows.map((row) => (row.blockerId === accountId ? row.blockedId : row.blockerId)));
  },

  pageBlocked: (db: Db, blockerId: string, limit: number, cursorBlockedId: string | undefined) =>
    db.block.findMany({
      where: { blockerId },
      orderBy: [{ createdAt: "desc" }, { blockedId: "desc" }],
      take: limit + 1,
      ...(cursorBlockedId === undefined ? {} : { cursor: { blockerId_blockedId: { blockerId, blockedId: cursorBlockedId } }, skip: 1 }),
    }),
};
