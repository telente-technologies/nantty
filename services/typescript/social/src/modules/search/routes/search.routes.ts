import type { HttpRouter } from "@zudojs/http";

import type { createSearchController } from "../controllers/search.controller.js";

export function registerSearchRoutes(router: HttpRouter, controller: ReturnType<typeof createSearchController>): void {
  router.get("/api/v1/search/people", controller.people);
}
