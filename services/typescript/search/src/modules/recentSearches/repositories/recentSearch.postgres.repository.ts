import { maximumRecentSearchesPerScope } from "../../../constants/search.constant.js";
import type { PrismaClient } from "../../../databases/prisma.database.js";
import type { RecentSearchStore } from "../../../interfaces/searchStore.interface.js";

export function createRecentSearchPostgresRepository(prisma: PrismaClient): RecentSearchStore {
  return {
    async record(accountId, scope, normalized, display) {
      await prisma.recentSearch.upsert({
        where: { accountId_scope_queryNormalized: { accountId, scope, queryNormalized: normalized } },
        create: { accountId, scope, queryNormalized: normalized, queryDisplay: display },
        update: { searchedAt: new Date(), queryDisplay: display },
      });
      const stale = await prisma.recentSearch.findMany({ where: { accountId, scope }, orderBy: { searchedAt: "desc" }, skip: maximumRecentSearchesPerScope, select: { id: true } });
      if (stale.length > 0) await prisma.recentSearch.deleteMany({ where: { id: { in: stale.map((row) => row.id) } } });
    },
    async list(accountId, scope, limit) {
      const rows = await prisma.recentSearch.findMany({ where: { accountId, scope }, orderBy: { searchedAt: "desc" }, take: limit });
      return rows.map((row) => ({ id: row.id, query: row.queryDisplay, scope: row.scope, searchedAt: row.searchedAt.toISOString() }));
    },
    async remove(accountId, id) {
      await prisma.recentSearch.deleteMany({ where: { accountId, id } });
    },
    async clear(accountId, scope) {
      await prisma.recentSearch.deleteMany({ where: scope === undefined ? { accountId } : { accountId, scope } });
    },
  };
}
