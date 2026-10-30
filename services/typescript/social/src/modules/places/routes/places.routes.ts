import type { HttpRouter } from "@nantty/fastify-platform";

import type { createPlacesController } from "../controllers/places.controller.js";

export function registerPlacesRoutes(router: HttpRouter, controller: ReturnType<typeof createPlacesController>): void {
  router.get("/api/v1/places/search", controller.search);
}
