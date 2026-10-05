import type { HttpRouter } from "@zudojs/http";

import type { createPostTagsController } from "../controllers/postTags.controller.js";

export function registerPostTagsRoutes(router: HttpRouter, controller: ReturnType<typeof createPostTagsController>): void {
  router.get("/api/v1/tags/candidates", controller.listCandidates);
  router.get("/api/v1/posts/:postId/tagged-users", controller.listTaggedUsers);
  router.put("/api/v1/posts/:postId/tags", controller.setPostTags);
  router.delete("/api/v1/posts/:postId/tags/me", controller.removeOwnTag);
  router.get("/api/v1/me/tagging-settings", controller.getSettings);
  router.put("/api/v1/me/tagging-settings", controller.updateSettings);
}
