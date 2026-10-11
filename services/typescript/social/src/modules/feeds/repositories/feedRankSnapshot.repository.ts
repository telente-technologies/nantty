import type { Prisma } from "../../../generated/prisma/client.js";
import type { Db } from "../../../types/database.type.js";

export const feedRankSnapshotLifetimeMs = 6 * 3_600_000;

export interface FeedRankSnapshotInput {
  readonly viewerId: string | undefined;
  readonly surface: string;
  readonly itemIds: readonly string[];
  readonly disclosures: Prisma.InputJsonObject;
  readonly createdAt: Date;
}

export const feedRankSnapshotsKeptPerViewer = 3;
export const guestFeedRankSnapshotReuseMs = 60_000;

export const feedRankSnapshotRepository = {
  create: async (db: Db, data: FeedRankSnapshotInput) => {
    await db.feedRankSnapshot.deleteMany({ where: { createdAt: { lt: new Date(data.createdAt.getTime() - feedRankSnapshotLifetimeMs) } } });
    const created = await db.feedRankSnapshot.create({ data: { viewerId: data.viewerId ?? null, surface: data.surface, itemIds: [...data.itemIds], disclosures: data.disclosures, createdAt: data.createdAt } });
    if (data.viewerId !== undefined) {
      const stale = await db.feedRankSnapshot.findMany({ where: { viewerId: data.viewerId, surface: data.surface }, orderBy: [{ createdAt: "desc" }, { id: "desc" }], skip: feedRankSnapshotsKeptPerViewer, select: { id: true } });
      if (stale.length > 0) await db.feedRankSnapshot.deleteMany({ where: { id: { in: stale.map((row) => row.id) } } });
    }
    return created;
  },

  findRecentGuestSnapshot: (db: Db, surface: string, createdSince: Date) =>
    db.feedRankSnapshot.findFirst({ where: { viewerId: null, surface, createdAt: { gt: createdSince } }, orderBy: { createdAt: "desc" } }),

  find: (db: Db, id: string) => db.feedRankSnapshot.findUnique({ where: { id } }),
};
