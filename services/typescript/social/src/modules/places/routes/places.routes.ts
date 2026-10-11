import type { HttpRouter } from "@zudojs/http";

import type { createPlacesController } from "../controllers/places.controller.js";

export function registerPlacesRoutes(router: HttpRouter, controller: ReturnType<typeof createPlacesController>): void {
  router.get("/api/v1/places/search", controller.search);
}
