import { maximumRecentSearchesPerAccount } from "../../../constants/search.constant.js";
import type { PrismaClient } from "../../../databases/prisma.database.js";
import type { RecentSearchStore } from "../../../interfaces/searchStore.interface.js";

export function createRecentSearchPostgresRepository(prisma: PrismaClient): RecentSearchStore {
  return {
    async record(accountId, normalized, display) {
      await prisma.recentSearch.upsert({
        where: { accountId_queryNormalized: { accountId, queryNormalized: normalized } },
        create: { accountId, queryNormalized: normalized, queryDisplay: display },
        update: { searchedAt: new Date(), queryDisplay: display },
      });
      const stale = await prisma.recentSearch.findMany({ where: { accountId }, orderBy: { searchedAt: "desc" }, skip: maximumRecentSearchesPerAccount, select: { id: true } });
      if (stale.length > 0) await prisma.recentSearch.deleteMany({ where: { id: { in: stale.map((row) => row.id) } } });
    },
    async list(accountId, limit) {
      const rows = await prisma.recentSearch.findMany({ where: { accountId }, orderBy: { searchedAt: "desc" }, take: limit });
      return rows.map((row) => ({ id: row.id, query: row.queryDisplay, searchedAt: row.searchedAt.toISOString() }));
    },
    async remove(accountId, id) {
      await prisma.recentSearch.deleteMany({ where: { accountId, id } });
    },
    async clear(accountId) {
      await prisma.recentSearch.deleteMany({ where: { accountId } });
    },
  };
}
