import type { SearchKind } from "./searchDocument.type.js";

export interface SearchRequest {
  readonly viewerId: string | undefined;
  readonly normalizedQuery: string;
  readonly kinds: readonly SearchKind[];
  readonly limit: number;
  readonly cursor: SearchCursor | undefined;
  readonly region: string | undefined;
  readonly viewerIsAdult?: boolean;
}

export interface SearchCursor {
  readonly score: number;
  readonly key: string;
}

export interface SearchHit {
  readonly kind: SearchKind;
  readonly entityId: string;
  readonly score: number;
  readonly summary: Readonly<Record<string, unknown>>;
  readonly popularity: number;
  readonly createdAt: string;
  readonly ownerAccountId: string | null;
}

export interface SearchHitPage {
  readonly hits: readonly SearchHit[];
  readonly hasMore: boolean;
}

export interface Page<T> {
  readonly data: readonly T[];
  readonly nextCursor: string | null;
}

export interface RecentSearch {
  readonly id: string;
  readonly query: string;
  readonly searchedAt: string;
}
