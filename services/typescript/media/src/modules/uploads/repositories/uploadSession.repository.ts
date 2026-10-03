import type { Prisma } from "../../../generated/prisma/client.js";
import type { Db } from "../../../types/database.type.js";

export const uploadSessionRepository = {
  findById: (db: Db, id: string) => db.uploadSession.findUnique({ where: { id } }),
  findByMediaId: (db: Db, mediaId: string) => db.uploadSession.findUnique({ where: { mediaId } }),
  findByIdempotencyKey: (db: Db, ownerId: string, key: string) => db.uploadSession.findFirst({ where: { ownerId, idempotencyKey: key } }),
  countActive: (db: Db, ownerId: string, now: Date) => db.uploadSession.count({ where: { ownerId, status: "uploading", expiresAt: { gt: now } } }),
  create: (db: Db, data: Prisma.UploadSessionUncheckedCreateInput) => db.uploadSession.create({ data }),
  update: (db: Db, id: string, data: Prisma.UploadSessionUpdateInput) => db.uploadSession.update({ where: { id }, data }),
  findExpiredOpen: (db: Db, now: Date, limit: number) => db.uploadSession.findMany({ where: { status: "uploading", expiresAt: { lte: now } }, take: limit }),
};
