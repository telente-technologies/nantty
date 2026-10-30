import type { HttpRouter } from "@nantty/fastify-platform";

import type { createPostAudienceController } from "../controllers/postAudience.controller.js";

export function registerPostAudienceRoutes(router: HttpRouter, controller: ReturnType<typeof createPostAudienceController>): void {
  router.patch("/api/v1/posts/:postId/reply-settings", controller.updateReplySettings);
  router.patch("/api/v1/posts/:postId/sensitivity", controller.updatePostSensitivity);
  router.get("/api/v1/posts/:postId/quotes", controller.listPostQuotes);
  router.post("/api/v1/posts/:postId/products", controller.setPostProducts);
}
