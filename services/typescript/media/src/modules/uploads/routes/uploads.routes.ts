import type { HttpRouter } from "@zudojs/http";

import type { createUploadsController } from "../controllers/uploads.controller.js";

export function registerUploadsRoutes(router: HttpRouter, controller: ReturnType<typeof createUploadsController>): void {
  router.post("/api/v1/media/uploads", controller.create);
  router.get("/api/v1/media/uploads/:uploadId", controller.status);
  router.delete("/api/v1/media/uploads/:uploadId", controller.abort);
  router.put("/api/v1/media/uploads/:uploadId/chunks/:chunkIndex", controller.uploadChunk);
  router.get("/api/v1/media/uploads/:uploadId/chunks/:chunkIndex/url", controller.chunkUrl);
  router.post("/api/v1/media/uploads/:uploadId/chunks/urls", controller.chunkUrls);
  router.post("/api/v1/media/uploads/:uploadId/complete", controller.complete);
  router.post("/api/v1/media/:mediaId/complete", controller.completeByMedia);
  router.get("/api/v1/media/:mediaId", controller.getMedia);
}
