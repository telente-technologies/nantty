import type { HttpRouter } from "@nantty/fastify-platform";

import type { createDigestsController } from "../controllers/digests.controller.js";

export function registerDigestsRoutes(router: HttpRouter, controller: ReturnType<typeof createDigestsController>): void {
  router.get("/api/v1/internal/digests/:kind", controller.list);
}
