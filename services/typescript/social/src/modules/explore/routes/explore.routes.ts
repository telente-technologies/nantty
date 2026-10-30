import type { HttpRouter } from "@nantty/fastify-platform";

import type { createExploreController } from "../controllers/explore.controller.js";

export function registerExploreRoutes(router: HttpRouter, controller: ReturnType<typeof createExploreController>): void {
  router.get("/api/v1/explore/categories", controller.categories);
  router.get("/api/v1/explore/trends", controller.trends);
  router.get("/api/v1/explore/headlines", controller.headlines);
  router.get("/api/v1/explore/who-to-follow", controller.whoToFollow);
  router.get("/api/v1/explore/posts-for-you", controller.postsForYou);
}
