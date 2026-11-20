import type { BrandSummary } from "./brand.type";
import type { ID, ProductSummary, StoreSummary, UserSummary } from "./models.type";

export type SearchScopeKey = "global" | "mart" | `store:${string}` | `profile:${string}`;

export interface SearchContext {
  readonly scope: SearchScopeKey;
  readonly label: string;
}

export type SearchResultType = "top" | "products" | "stores" | "brands" | "people" | "posts" | "clips" | "hashtags";

export interface SearchPostItem {
  readonly type: "post" | "clip";
  readonly id: ID;
  readonly authorId: ID;
  readonly caption: string;
  readonly thumbnailUrl: string | null;
  readonly likes: number;
  readonly views: number;
}

export type SearchItem =
  | ({ readonly type: "product" } & ProductSummary)
  | ({ readonly type: "store" } & StoreSummary)
  | ({ readonly type: "brand" } & BrandSummary)
  | ({ readonly type: "user" } & UserSummary)
  | SearchPostItem
  | { readonly type: "hashtag"; readonly id: string; readonly tag: string; readonly postCount: number }
  | { readonly type: "category"; readonly id: ID; readonly name: string };

export interface SearchPage {
  readonly data: readonly SearchItem[];
  readonly nextCursor: string | null;
  readonly scope: SearchScopeKey;
}

export interface RecentSearchEntry {
  readonly id: ID;
  readonly query: string;
  readonly scope: SearchScopeKey;
  readonly searchedAt: string;
}

export interface SearchSuggestion {
  readonly type: "user" | "store" | "brand" | "product" | "hashtag" | "category" | "post" | "clip";
  readonly id: ID;
  readonly text: string;
}
