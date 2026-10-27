import type { HttpRouter } from "@nantty/fastify-platform";

import type { createSearchController } from "../controllers/search.controller.js";

export function registerSearchRoutes(router: HttpRouter, controller: ReturnType<typeof createSearchController>): void {
  router.get("/api/v1/search", controller.search);
  router.get("/api/v1/search/suggest", controller.suggest);
}
