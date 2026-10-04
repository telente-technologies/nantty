import { ApiError } from "@/errors/api.error";

import { catalogProductSeeds, productIdForKey } from "./productCatalog.mock";
import { createMockRoute } from "./registry.mock";
import { directoryStores } from "./storeDirectory.mock";
import { directoryUsersExcludingAccounts } from "./userDirectory.mock";

const SITEMAP_PAGE_SIZE = 500;

const entriesByKind = {
  products: () => catalogProductSeeds.map((seed) => ({ id: productIdForKey(seed.key), name: seed.name, updatedAt: null })),
  stores: () => directoryStores.map((store) => ({ id: store.id, name: store.name, updatedAt: null })),
  profiles: () => directoryUsersExcludingAccounts.map((user) => ({ id: user.id, name: user.username, updatedAt: null })),
} as const;

export const sitemapMocks = [
  createMockRoute("GET", "/api/v1/sitemap/:kind", ({ params, query }) => {
    const build = entriesByKind[params.kind as keyof typeof entriesByKind];
    if (!build) throw new ApiError(404, "Unknown sitemap");
    const entries = build();
    const page = Math.max(0, Number(query.get("page") ?? 0) || 0);
    return { entries: entries.slice(page * SITEMAP_PAGE_SIZE, (page + 1) * SITEMAP_PAGE_SIZE), totalPages: Math.ceil(entries.length / SITEMAP_PAGE_SIZE) };
  }),
];
