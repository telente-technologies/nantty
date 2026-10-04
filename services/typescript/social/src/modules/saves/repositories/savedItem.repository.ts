import type { SavedItemType } from "../../../generated/prisma/client.js";
import type { Db } from "../../../types/database.type.js";
import { isUniqueConstraintViolationError } from "../../../utils/prismaError.util.js";
import { adjustSaveCount } from "../services/saveCounter.service.js";

export const savedItemRepository = {
  saveAndCount: async (db: Db, userId: string, type: SavedItemType, targetId: string, collectionId: string | undefined): Promise<boolean> => {
    const where = { userId_type_targetId: { userId, type, targetId } };
    const existing = await db.savedItem.findUnique({ where });
    if (existing !== null) {
      if (collectionId !== undefined) await db.savedItem.update({ where, data: { collectionId } });
      return false;
    }
    try {
      await db.savedItem.create({ data: { userId, type, targetId, ...(collectionId === undefined ? {} : { collectionId }) } });
    } catch (error) {
      if (isUniqueConstraintViolationError(error)) return false;
      throw error;
    }
    await adjustSaveCount(db, type, targetId, 1);
    return true;
  },

  unsaveAndCount: async (db: Db, userId: string, type: SavedItemType | undefined, targetId: string): Promise<number> => {
    const rows = await db.savedItem.findMany({ where: { userId, targetId, ...(type === undefined ? {} : { type }) }, select: { id: true, type: true } });
    let removed = 0;
    for (const row of rows) {
      if ((await db.savedItem.deleteMany({ where: { id: row.id } })).count === 0) continue;
      removed += 1;
      await adjustSaveCount(db, row.type, targetId, -1);
    }
    return removed;
  },

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
