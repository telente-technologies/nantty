import type { HttpRouter } from "@nantty/fastify-platform";

import type { createStoreFollowsController } from "../controllers/storeFollows.controller.js";

export function registerStoreFollowsRoutes(router: HttpRouter, controller: ReturnType<typeof createStoreFollowsController>): void {
  router.post("/api/v1/stores/:storeId/follow", controller.follow);
  router.delete("/api/v1/stores/:storeId/follow", controller.unfollow);
  router.get("/api/v1/stores/:storeId/followers", controller.followers);
  router.get("/api/v1/stores/:storeId/follow-status", controller.status);
  router.get("/api/v1/internal/stores/:storeId/follow-stats", controller.internalStats);
}
