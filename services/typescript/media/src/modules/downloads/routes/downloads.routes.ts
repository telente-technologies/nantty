import type { HttpRouter } from "@zudojs/http";

import type { createDownloadsController } from "../controllers/downloads.controller.js";

export function registerDownloadsRoutes(router: HttpRouter, controller: ReturnType<typeof createDownloadsController>): void {
  router.post("/internal/v1/media/:mediaId/download-variant", controller.requestVariant);
}
