import type { SearchContext, SearchResultType, SearchScopeKey } from "@/types/search.type";

export const globalSearchContext: SearchContext = { scope: "global", label: "" };
export const martSearchContext: SearchContext = { scope: "mart", label: "Mart" };

export const storeSearchContext = (storeId: string, storeName: string): SearchContext => ({ scope: `store:${storeId}`, label: storeName });

export const profileSearchContext = (userId: string, username: string): SearchContext => ({ scope: `profile:${userId}`, label: `@${username.replace(/^@/, "")}` });

export const searchScopeKind = (scope: SearchScopeKey): "global" | "mart" | "store" | "profile" =>
  scope === "global" || scope === "mart" ? scope : scope.startsWith("store:") ? "store" : "profile";

export function resolveSearchContext(scope: string | undefined, label: string | undefined): SearchContext {
  if (scope === "mart") return martSearchContext;
  if (scope?.startsWith("store:") || scope?.startsWith("profile:")) return { scope: scope as SearchScopeKey, label: label?.trim() || (scope.startsWith("store:") ? "this store" : "this profile") };
  return globalSearchContext;
}

export const searchPlaceholder = (context: SearchContext): string =>
  context.scope === "global" ? "Search people, posts, products..." : `Search ${context.label}`;

export const searchScopeChipLabel = (context: SearchContext): string | null => (context.scope === "global" ? null : `In: ${context.label}`);

const resultTypesByScope: Readonly<Record<ReturnType<typeof searchScopeKind>, readonly { readonly label: string; readonly type: SearchResultType }[]>> = {
  global: [
    { label: "Top", type: "top" },
    { label: "People", type: "people" },
    { label: "Posts", type: "posts" },
    { label: "Clips", type: "clips" },
    { label: "Products", type: "products" },
    { label: "Stores", type: "stores" },
    { label: "Brands", type: "brands" },
    { label: "Hashtags", type: "hashtags" },
  ],
  mart: [],
  store: [
    { label: "All", type: "top" },
    { label: "Products", type: "products" },
    { label: "Posts", type: "posts" },
  ],
  profile: [
    { label: "All", type: "top" },
    { label: "Posts", type: "posts" },
    { label: "Clips", type: "clips" },
    { label: "Products", type: "products" },
  ],
};

const ownStoreResultTypes: readonly { readonly label: string; readonly type: SearchResultType }[] = [
  { label: "All", type: "top" },
  { label: "Products", type: "products" },
  { label: "Posts", type: "posts" },
];

export const searchResultTypesForScope = (scope: SearchScopeKey, ownStoreId?: string | null) =>
  ownStoreId && scope === `store:${ownStoreId}` ? ownStoreResultTypes : resultTypesByScope[searchScopeKind(scope)];

export const defaultSearchResultType = (scope: SearchScopeKey): SearchResultType => (scope === "mart" ? "products" : "top");
