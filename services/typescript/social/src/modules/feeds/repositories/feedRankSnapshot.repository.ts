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

export const feedRankSnapshotRepository = {
  create: async (db: Db, data: FeedRankSnapshotInput) => {
    await db.feedRankSnapshot.deleteMany({ where: { createdAt: { lt: new Date(data.createdAt.getTime() - feedRankSnapshotLifetimeMs) } } });
    return db.feedRankSnapshot.create({ data: { viewerId: data.viewerId ?? null, surface: data.surface, itemIds: [...data.itemIds], disclosures: data.disclosures, createdAt: data.createdAt } });
  },

  find: (db: Db, id: string) => db.feedRankSnapshot.findUnique({ where: { id } }),
};
