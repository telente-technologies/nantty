import type { Prisma } from "../../../generated/prisma/client.js";
import type { Db } from "../../../types/database.type.js";

export type LinkPreviewCacheRow = Prisma.LinkPreviewCacheGetPayload<object>;

export const linkPreviewCacheRepository = {
  findFresh: (db: Db, normalizedUrl: string, now: Date): Promise<LinkPreviewCacheRow | null> =>
    db.linkPreviewCache.findFirst({ where: { normalizedUrl, expiresAt: { gt: now } } }),

  save: (db: Db, row: Omit<Prisma.LinkPreviewCacheCreateInput, "normalizedUrl"> & { readonly normalizedUrl: string }) =>
    db.linkPreviewCache.upsert({ where: { normalizedUrl: row.normalizedUrl }, create: row, update: row }),

  attachToPost: (db: Db, postId: string, preview: Prisma.InputJsonValue) => db.post.updateMany({ where: { id: postId, deletedAt: null }, data: { linkPreview: preview } }),
};
