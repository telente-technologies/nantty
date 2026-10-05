import type { Db } from "../../../types/database.type.js";

export const preKeyClaimRepository = {
  countSince: (db: Db, requesterId: string, since: Date, targetId?: string) =>
    db.chatPreKeyClaim.count({ where: { requesterId, claimedAt: { gte: since }, ...(targetId === undefined ? {} : { targetId }) } }),

  record: (db: Db, requesterId: string, targetIds: readonly string[], claimedAt: Date) =>
    db.chatPreKeyClaim.createMany({ data: targetIds.map((targetId) => ({ requesterId, targetId, claimedAt })) }),

  pruneBefore: (db: Db, requesterId: string, before: Date) => db.chatPreKeyClaim.deleteMany({ where: { requesterId, claimedAt: { lt: before } } }),
};
