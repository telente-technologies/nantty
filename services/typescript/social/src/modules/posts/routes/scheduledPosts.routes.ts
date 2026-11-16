import type { HttpRouter } from "@nantty/fastify-platform";

import type { createScheduledPostsController } from "../controllers/scheduledPosts.controller.js";

export function registerScheduledPostsRoutes(router: HttpRouter, controller: ReturnType<typeof createScheduledPostsController>): void {
  router.get("/api/v1/posts/scheduled", controller.list);
  router.patch("/api/v1/posts/:postId/schedule", controller.reschedule);
  router.patch("/api/v1/posts/:postId/schedule/content", controller.editContent);
  router.post("/api/v1/posts/:postId/schedule/publish-now", controller.publishNow);
  router.delete("/api/v1/posts/:postId/schedule", controller.cancel);
}
