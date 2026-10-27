import type { HttpRouter } from "@nantty/fastify-platform";

import type { createRecentSearchesController } from "../controllers/recentSearches.controller.js";

export function registerRecentSearchesRoutes(router: HttpRouter, controller: ReturnType<typeof createRecentSearchesController>): void {
  router.get("/api/v1/search/recent", controller.list);
  router.post("/api/v1/search/recent", controller.record);
  router.delete("/api/v1/search/recent/:id", controller.remove);
  router.delete("/api/v1/search/recent", controller.clear);
}
