import type { HttpRouter } from "@zudojs/http";

import type { createIndexingController } from "../controllers/indexing.controller.js";

export function registerIndexingRoutes(router: HttpRouter, controller: ReturnType<typeof createIndexingController>): void {
  router.post("/internal/search/events", controller.ingestEvent);
  router.get("/internal/search/event-types", controller.listHandledEventTypes);
}
