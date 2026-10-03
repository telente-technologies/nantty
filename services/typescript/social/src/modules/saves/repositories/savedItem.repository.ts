import type { SavedItemType } from "../../../generated/prisma/client.js";
import type { Db } from "../../../types/database.type.js";

export const savedItemRepository = {
  upsert: (db: Db, userId: string, type: SavedItemType, targetId: string, collectionId: string | undefined) =>
    db.savedItem.upsert({
      where: { userId_type_targetId: { userId, type, targetId } },
      create: { userId, type, targetId, ...(collectionId === undefined ? {} : { collectionId }) },
      update: collectionId === undefined ? {} : { collectionId },
    }),

  delete: (db: Db, userId: string, type: SavedItemType | undefined, targetId: string) =>
    db.savedItem.deleteMany({ where: { userId, targetId, ...(type === undefined ? {} : { type }) } }),

  findById: (db: Db, id: string) => db.savedItem.findUnique({ where: { id } }),

  setCollection: (db: Db, id: string, collectionId: string | null) => db.savedItem.update({ where: { id }, data: { collectionId } }),

  page: (db: Db, userId: string, types: readonly SavedItemType[] | undefined, collectionId: string | undefined, limit: number, cursor: string | undefined) =>
    db.savedItem.findMany({
      where: { userId, ...(types === undefined ? {} : { type: { in: [...types] } }), ...(collectionId === undefined ? {} : { collectionId }) },
      orderBy: { id: "desc" },
      take: limit + 1,
      ...(cursor === undefined ? {} : { cursor: { id: cursor }, skip: 1 }),
    }),

  savedTargetIds: async (db: Db, userId: string, targetIds: readonly string[]) => {
    const rows = await db.savedItem.findMany({ where: { userId, type: { in: ["post", "video", "clip"] }, targetId: { in: [...targetIds] } }, select: { targetId: true } });
    return new Set(rows.map((row) => row.targetId));
  },

  countByCollection: async (db: Db, userId: string) => {
    const groups = await db.savedItem.groupBy({ by: ["collectionId"], where: { userId, collectionId: { not: null } }, _count: { _all: true } });
    return new Map(groups.flatMap((group) => (group.collectionId === null ? [] : [[group.collectionId, group._count._all] as const])));
  },
};
