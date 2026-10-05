import type { Post } from "@/types";
import type { RecentSearchEntry, SearchItem, SearchResultType, SearchScopeKey } from "@/types/search.type";

import { mockBrandRecords, presentBrandSummary } from "./brandDirectory.mock";
import { followedBrandIds } from "./brands.mock";
import { mockPostsState } from "./postCatalog.mock";
import { buildCatalogProductSummary, catalogProductSeeds, isMartSponsoredSeed, type CatalogProductSeed } from "./productCatalog.mock";
import { buildOrderFromRecord } from "./escrowBuilders.mock";
import { getSignedInMockUser } from "./fixtures.mock";
import { mockOrderRecords } from "./orderFixtures.mock";
import { createMockRoute, type MockRoute } from "./registry.mock";
import { blockedUserIds, isAuthorContentVisibleToSignedInViewer } from "./socialGraph.mock";
import { directoryStores, findDirectoryStoreById, summariseStore } from "./storeDirectory.mock";
import { directoryUsersExcludingAccounts, summariseUser } from "./userDirectory.mock";

const PAGE_SIZE = 20;
const MAX_RECENTS_PER_SCOPE = 20;
const recentSearches: RecentSearchEntry[] = [];
let recentSequence = 0;

const itemTypesByResultType: Readonly<Record<SearchResultType, readonly SearchItem["type"][]>> = {
  top: ["user", "store", "brand", "product", "post", "clip", "hashtag", "category"],
  people: ["user"],
  posts: ["post"],
  clips: ["clip"],
  products: ["product"],
  stores: ["store"],
  brands: ["brand"],
  hashtags: ["hashtag"],
  orders: ["order"],
};

const matches = (text: string | null | undefined, term: string) => (text ?? "").toLowerCase().includes(term);

const isPostSearchable = (post: Post) =>
  !post.subscriberOnly && !post.sponsored && !(post.sensitive?.labels.length) && !blockedUserIds.has(post.author.id) && post.author.account?.status !== "suspended" && isAuthorContentVisibleToSignedInViewer(post.author.id);

const toPostItem = (post: Post): SearchItem => ({
  type: post.kind,
  id: post.id,
  authorId: post.author.id,
  caption: post.text,
  thumbnailUrl: post.media[0]?.posterUrl ?? post.media[0]?.url ?? null,
  likes: post.likes,
  views: post.views,
});

const productItems = (seeds: readonly CatalogProductSeed[], term: string, withSponsored: boolean): SearchItem[] => {
  const matching = seeds.filter((seed) => matches(seed.name, term) || matches(seed.title, term) || matches(findDirectoryStoreById(seed.storeId).name, term));
  const sponsored = withSponsored && matching.length > 0 ? catalogProductSeeds.find((seed) => isMartSponsoredSeed(seed) && seed.categoryId === matching[0]?.categoryId) : undefined;
  return [
    ...(sponsored ? [{ type: "product" as const, ...buildCatalogProductSummary(sponsored, { sponsored: true }) }] : []),
    ...matching.filter((seed) => seed !== sponsored).map((seed) => ({ type: "product" as const, ...buildCatalogProductSummary(seed) })),
  ];
};

const ownStoreOrderItems = (storeId: string, term: string): SearchItem[] => {
  if (getSignedInMockUser().storeId !== storeId) return [];
  return mockOrderRecords
    .filter((record) => record.storeId === storeId)
    .map(buildOrderFromRecord)
    .filter((order) => matches(order.reference, term) || matches(order.buyer.name, term) || matches(order.buyer.username, term) || order.items.some((line) => matches(line.product.name, term)))
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .map((order) => ({
      type: "order" as const,
      id: order.id,
      reference: order.reference,
      status: order.status,
      buyerName: order.buyer.name,
      itemSummary: order.items.map((line) => line.product.name).join(", "),
      total: order.total,
      createdAt: order.createdAt,
    }));
};

const postItems = (posts: readonly Post[], term: string) => posts.filter((post) => isPostSearchable(post) && matches(post.text, term)).map(toPostItem);

const hashtagItems = (posts: readonly Post[], term: string): SearchItem[] => {
  const counts = new Map<string, number>();
  for (const post of posts.filter(isPostSearchable))
    for (const match of post.text.matchAll(/#([\p{L}\p{N}_]+)/gu)) {
      const tag = (match[1] ?? "").toLowerCase();
      if (tag.includes(term.replace(/^#/, ""))) counts.set(tag, (counts.get(tag) ?? 0) + 1);
    }
  return [...counts].map(([tag, postCount]) => ({ type: "hashtag", id: tag, tag, postCount }));
};

function searchGlobal(term: string): SearchItem[] {
  const posts = [...mockPostsState.values()];
  return [
    ...directoryUsersExcludingAccounts.filter((user) => !blockedUserIds.has(user.id) && (matches(user.name, term) || matches(user.username, term))).slice(0, 8).map((user) => ({ type: "user" as const, ...summariseUser(user) })),
    ...directoryStores.filter((store) => matches(store.name, term) || matches(store.bio, term)).map((store) => ({ type: "store" as const, ...summariseStore(store) })),
    ...mockBrandRecords.filter((brand) => matches(brand.name, term) || matches(brand.handle, term) || matches(brand.description, term)).map((brand) => ({ type: "brand" as const, ...presentBrandSummary(brand, followedBrandIds) })),
    ...productItems(catalogProductSeeds, term, true).slice(0, 16),
    ...postItems(posts, term),
    ...hashtagItems(posts, term),
  ];
}

export function searchMockCatalog(term: string, scope: SearchScopeKey): SearchItem[] {
  if (scope === "mart") return productItems(catalogProductSeeds, term, true);
  const [kind, id = ""] = scope.split(":");
  const posts = [...mockPostsState.values()];
  if (kind === "store") {
    const store = directoryStores.find((candidate) => candidate.id === id);
    if (!store || blockedUserIds.has(store.ownerUserKey)) return [];
    return [...productItems(catalogProductSeeds.filter((seed) => seed.storeId === id), term, false), ...ownStoreOrderItems(id, term), ...postItems(posts.filter((post) => post.author.id === store.ownerUserKey), term)];
  }
  if (kind === "profile") {
    const storeIds = new Set(directoryStores.filter((store) => store.ownerUserKey === id).map((store) => store.id));
    return [...postItems(posts.filter((post) => post.author.id === id), term), ...productItems(catalogProductSeeds.filter((seed) => storeIds.has(seed.storeId)), term, false)];
  }
  return searchGlobal(term);
}

const readScope = (raw: unknown): SearchScopeKey => {
  const value = typeof raw === "string" ? raw : "";
  return value === "mart" || value.startsWith("store:") || value.startsWith("profile:") ? (value as SearchScopeKey) : "global";
};

export const searchMocks: MockRoute[] = [
  createMockRoute("GET", "/api/v1/search", ({ query }) => {
    const term = (query.get("q") ?? "").trim().toLowerCase();
    const scope = readScope(query.get("scope"));
    const type = (query.get("type") ?? "top") as SearchResultType;
    const wanted = itemTypesByResultType[type] ?? itemTypesByResultType.top;
    const items = term === "" ? [] : searchMockCatalog(term, scope).filter((item) => wanted.includes(item.type));
    const start = Number(query.get("cursor") ?? 0) || 0;
    return { data: items.slice(start, start + PAGE_SIZE), nextCursor: start + PAGE_SIZE < items.length ? String(start + PAGE_SIZE) : null, scope };
  }),
  createMockRoute("GET", "/api/v1/search/recent", ({ query }) => {
    const scope = readScope(query.get("scope"));
    return { data: recentSearches.filter((entry) => entry.scope === scope), nextCursor: null };
  }),
  createMockRoute("POST", "/api/v1/search/recent", ({ body }) => {
    const input = (body ?? {}) as { q?: unknown; scope?: unknown };
    const query = typeof input.q === "string" ? input.q.trim() : "";
    if (query === "") return null;
    const scope = readScope(input.scope);
    const existing = recentSearches.findIndex((entry) => entry.scope === scope && entry.query.toLowerCase() === query.toLowerCase());
    if (existing >= 0) recentSearches.splice(existing, 1);
    recentSequence += 1;
    recentSearches.unshift({ id: `recent_${recentSequence}`, query, scope, searchedAt: new Date().toISOString() });
    const inScope = recentSearches.filter((entry) => entry.scope === scope);
    for (const stale of inScope.slice(MAX_RECENTS_PER_SCOPE)) recentSearches.splice(recentSearches.indexOf(stale), 1);
    return null;
  }),
  createMockRoute("DELETE", "/api/v1/search/recent/:id", ({ params }) => {
    const index = recentSearches.findIndex((entry) => entry.id === params["id"]);
    if (index >= 0) recentSearches.splice(index, 1);
    return null;
  }),
  createMockRoute("DELETE", "/api/v1/search/recent", ({ query }) => {
    const scope = query.get("scope");
    for (let index = recentSearches.length - 1; index >= 0; index -= 1) if (scope === null || recentSearches[index]?.scope === readScope(scope)) recentSearches.splice(index, 1);
    return null;
  }),
];
