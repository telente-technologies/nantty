import { legacyGroupLimit, suggestionLimit } from "../../../constants/search.constant.js";
import { globalSearchScope, type SearchScope } from "../../../enums/searchScope.enum.js";
import { kindsByType, type SearchType } from "../../../enums/searchType.enum.js";
import type { SearchReranker } from "../../../interfaces/searchReranker.interface.js";
import type { SearchIndexStore, SearchQueryStore } from "../../../interfaces/searchStore.interface.js";
import type { SearchKind } from "../../../types/searchDocument.type.js";
import type { Page, SearchHit } from "../../../types/searchResult.type.js";
import { decodeSearchCursor, encodeSearchCursor } from "../../../utils/cursor.util.js";
import { normalizeSearchText } from "../../../utils/queryNormalizer.util.js";
import { formatSearchScope, restrictKindsToScope } from "../../../utils/searchScope.util.js";
import { applyRerankOrder, buildRerankCandidates } from "./rerankOrdering.service.js";

export interface SearchInput {
  readonly viewerId: string | undefined;
  readonly query: string;
  readonly scope?: SearchScope;
  readonly type: Exclude<SearchType, "all">;
  readonly cursor: string | undefined;
  readonly limit: number;
  readonly region: string | undefined;
  readonly viewerIsAdult?: boolean;
}

export interface LegacyGroupedResults {
  readonly products: readonly unknown[];
  readonly stores: readonly unknown[];
  readonly people: readonly unknown[];
  readonly brands: readonly unknown[];
}

export interface Suggestion {
  readonly type: SearchKind;
  readonly id: string;
  readonly text: string;
}

export interface SearchQueryService {
  search(input: SearchInput): Promise<Page<Record<string, unknown>> & { readonly scope: string }>;
  searchGrouped(viewerId: string | undefined, query: string, region: string | undefined): Promise<LegacyGroupedResults>;
  suggest(viewerId: string | undefined, query: string): Promise<readonly Suggestion[]>;
}

const toItem = (hit: SearchHit): Record<string, unknown> => ({ ...hit.summary, type: hit.kind });

export function createSearchQueryService(queryStore: SearchQueryStore, indexStore: Pick<SearchIndexStore, "hasConsent">, reranker: SearchReranker): SearchQueryService {
  const fetchHits = (viewerId: string | undefined, query: string, kinds: readonly SearchKind[], limit: number, region: string | undefined, cursor?: string, viewerIsAdult = false, scope: SearchScope = globalSearchScope) =>
    queryStore.search({ viewerId, normalizedQuery: normalizeSearchText(query), kinds, limit, region, cursor: decodeSearchCursor(cursor), viewerIsAdult, scope });
  return {
    async search(input) {
      const scope = input.scope ?? globalSearchScope;
      const kinds = restrictKindsToScope(kindsByType[input.type], scope);
      if (kinds.length === 0) return { data: [], nextCursor: null, scope: formatSearchScope(scope) };
      const page = await fetchHits(input.viewerId, input.query, kinds, input.limit, input.region, input.cursor, input.viewerIsAdult === true, scope);
      let hits = [...page.hits];
      if (input.cursor === undefined && input.viewerId !== undefined && hits.length > 1 && (await indexStore.hasConsent(input.viewerId, "personalization"))) {
        const order = await reranker.rerank(input.viewerId, buildRerankCandidates(hits), hits.length);
        if (order !== null) hits = applyRerankOrder(hits, order);
      }
      const last = page.hits.at(-1);
      return { data: hits.map(toItem), nextCursor: page.hasMore && last !== undefined ? encodeSearchCursor({ score: last.score, key: `${last.kind}:${last.entityId}` }) : null, scope: formatSearchScope(scope) };
    },
    async searchGrouped(viewerId, query, region) {
      const [products, stores, brands, people] = await Promise.all((["product", "store", "brand", "user"] as const).map((kind) => fetchHits(viewerId, query, [kind], kind === "user" ? 8 : legacyGroupLimit, region)));
      const items = (page: { readonly hits: readonly SearchHit[] } | undefined) => (page?.hits ?? []).map((hit) => hit.summary);
      return { products: items(products), stores: items(stores), brands: items(brands), people: items(people) };
    },
    async suggest(viewerId, query) {
      const page = await fetchHits(viewerId, query, ["user", "store", "brand", "product", "hashtag", "category"], suggestionLimit, undefined);
      return page.hits.map((hit) => ({ type: hit.kind, id: hit.entityId, text: String(hit.summary["name"] ?? hit.summary["username"] ?? hit.summary["tag"] ?? "") }));
    },
  };
}
