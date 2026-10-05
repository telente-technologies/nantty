import type { HttpRouter } from "@zudojs/http";

import type { createDownloadsController } from "../controllers/downloads.controller.js";

export function registerDownloadsRoutes(router: HttpRouter, controller: ReturnType<typeof createDownloadsController>): void {
  router.post("/api/v1/posts/:postId/media/:mediaId/download", controller.requestDownload);
  router.get("/api/v1/me/download-settings", controller.getSettings);
  router.put("/api/v1/me/download-settings", controller.updateSettings);
}
