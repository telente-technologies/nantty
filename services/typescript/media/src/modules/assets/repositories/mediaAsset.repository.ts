import type { Prisma } from "../../../generated/prisma/client.js";
import type { Db } from "../../../types/database.type.js";
import type { MediaAssetWithVariants } from "../models/mediaAsset.model.js";

export const mediaAssetRepository = {
  findById(db: Db, id: string): Promise<MediaAssetWithVariants | null> {
    return db.mediaAsset.findUnique({ where: { id }, include: { variants: true } });
  },

  findManyByIds(db: Db, ids: readonly string[]): Promise<MediaAssetWithVariants[]> {
    return db.mediaAsset.findMany({ where: { id: { in: [...ids] } }, include: { variants: true } });
  },

  findExpired(db: Db, now: Date, limit: number): Promise<{ id: string }[]> {
    return db.mediaAsset.findMany({ where: { expiresAt: { lte: now }, status: { not: "deleted" } }, select: { id: true }, orderBy: { expiresAt: "asc" }, take: limit });
  },

  update(db: Db, id: string, data: Prisma.MediaAssetUpdateInput) {
    return db.mediaAsset.update({ where: { id }, data });
  },
};
