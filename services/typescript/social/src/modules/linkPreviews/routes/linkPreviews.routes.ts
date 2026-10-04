import type { HttpRouter } from "@zudojs/http";

import type { createLinkPreviewsController } from "../controllers/linkPreviews.controller.js";

export function registerLinkPreviewsRoutes(router: HttpRouter, controller: ReturnType<typeof createLinkPreviewsController>): void {
  router.get("/api/v1/link-previews/resolve", controller.resolve);
  router.post("/api/v1/posts/:postId/link-preview", controller.refreshForPost);
}
