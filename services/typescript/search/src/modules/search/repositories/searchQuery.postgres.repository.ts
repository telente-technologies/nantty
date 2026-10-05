import type { PrismaClient } from "../../../databases/prisma.database.js";
import { globalSearchScope } from "../../../enums/searchScope.enum.js";
import type { SearchQueryStore } from "../../../interfaces/searchStore.interface.js";
import { searchRows } from "../../../repositories/searchQueries.repository.js";
import type { SearchHit } from "../../../types/searchResult.type.js";
import { buildPrefixTsQuery, escapeLikePattern, extractQueryTokens, stripLeadingMarkers } from "../../../utils/queryNormalizer.util.js";

export function createSearchQueryPostgresRepository(prisma: PrismaClient): SearchQueryStore {
  return {
    async search(request) {
      const tokens = extractQueryTokens(request.normalizedQuery);
      if (tokens.length === 0) return { hits: [], hasMore: false };
      const needle = stripLeadingMarkers(request.normalizedQuery);
      const rows = await searchRows(prisma, {
        needle, tsQuery: buildPrefixTsQuery(tokens), kinds: request.kinds, viewerId: request.viewerId ?? null, viewerIsAdult: request.viewerIsAdult === true, region: request.region ?? null,
        likePattern: `${escapeLikePattern(needle)}%`, cursor: request.cursor, limit: request.limit + 1, scope: request.scope ?? globalSearchScope,
      });
      const hits: SearchHit[] = rows.map((row) => ({ kind: row.kind, entityId: row.entity_id, score: Number(row.score), summary: row.summary, popularity: Number(row.popularity), createdAt: new Date(row.created_at).toISOString(), ownerAccountId: row.owner_account_id }));
      return { hits: hits.slice(0, request.limit), hasMore: hits.length > request.limit };
    },
  };
}
