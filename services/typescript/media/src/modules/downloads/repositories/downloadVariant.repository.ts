import type { Prisma } from "../../../generated/prisma/client.js";
import type { Db } from "../../../types/database.type.js";

export type DownloadVariantRow = Prisma.MediaDownloadVariantGetPayload<Record<string, never>>;

export const downloadVariantRepository = {
  findByCacheKey(db: Db, assetId: string, cacheKey: string): Promise<DownloadVariantRow | null> {
    return db.mediaDownloadVariant.findUnique({ where: { assetId_cacheKey: { assetId, cacheKey } } });
  },

  findById(db: Db, id: string): Promise<DownloadVariantRow | null> {
    return db.mediaDownloadVariant.findUnique({ where: { id } });
  },

  createPending(db: Db, data: { readonly assetId: string; readonly cacheKey: string; readonly watermarkHandle: string; readonly sourceKey: string; readonly stripAudio: boolean }): Promise<DownloadVariantRow> {
    return db.mediaDownloadVariant.create({ data: { ...data, status: "pending" } });
  },

  update(db: Db, id: string, data: Prisma.MediaDownloadVariantUpdateInput): Promise<DownloadVariantRow> {
    return db.mediaDownloadVariant.update({ where: { id }, data });
  },

  findByAsset(db: Db, assetId: string): Promise<DownloadVariantRow[]> {
    return db.mediaDownloadVariant.findMany({ where: { assetId } });
  },

  deleteByAsset(db: Db, assetId: string): Promise<unknown> {
    return db.mediaDownloadVariant.deleteMany({ where: { assetId } });
  },
};
