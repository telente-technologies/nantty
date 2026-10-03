import type { HttpRouter } from "@zudojs/http";

import type { createFeedsController } from "../controllers/feeds.controller.js";

export function registerFeedsRoutes(router: HttpRouter, controller: ReturnType<typeof createFeedsController>): void {
  router.get("/api/v1/feeds/for-you", controller.forYou);
  router.get("/api/v1/feeds/popular", controller.popular);
  router.get("/api/v1/feeds/following", controller.following);
  router.get("/api/v1/feeds/suggested-clips", controller.suggestedClips);
  router.get("/api/v1/clips", controller.clips);
  router.post("/api/v1/feeds/feedback", controller.feedback);
}
