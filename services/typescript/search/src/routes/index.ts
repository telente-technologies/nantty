import type { HttpRouter } from "@zudojs/http";

import { createIndexingController } from "../modules/indexing/controllers/indexing.controller.js";
import { registerIndexingRoutes } from "../modules/indexing/routes/indexing.routes.js";
import type { SearchEventProcessor } from "../modules/indexing/services/searchEventProcessor.service.js";
import { createRecentSearchesController } from "../modules/recentSearches/controllers/recentSearches.controller.js";
import { registerRecentSearchesRoutes } from "../modules/recentSearches/routes/recentSearches.routes.js";
import { createSearchController } from "../modules/search/controllers/search.controller.js";
import { registerSearchRoutes } from "../modules/search/routes/search.routes.js";
import type { SearchQueryService } from "../modules/search/services/searchQuery.service.js";
import type { RecentSearchStore } from "../interfaces/searchStore.interface.js";
import { json } from "../utils/http.util.js";

export interface RouteDependencies {
  readonly searchService: SearchQueryService;
  readonly recentSearches: RecentSearchStore;
  readonly eventProcessor: SearchEventProcessor;
  readonly internalToken: string;
  readonly probeDatabase: (() => Promise<void>) | undefined;
}

export function registerRoutes(router: HttpRouter, dependencies: RouteDependencies): void {
  router.get("/healthz", () => json(200, { status: "up", service: "search" }));
  router.get("/readyz", async () => {
    try {
      await dependencies.probeDatabase?.();
      return json(200, { status: "ready" });
    } catch {
      return json(503, { status: "unavailable" });
    }
  });
  registerRecentSearchesRoutes(router, createRecentSearchesController(dependencies.recentSearches));
  registerSearchRoutes(router, createSearchController(dependencies.searchService));
  registerIndexingRoutes(router, createIndexingController(dependencies.eventProcessor, dependencies.internalToken));
}
