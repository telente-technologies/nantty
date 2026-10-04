import type { HttpRouter } from "@zudojs/http";

import type { createInternalController } from "../controllers/internal.controller.js";

export function registerInternalRoutes(router: HttpRouter, controller: ReturnType<typeof createInternalController>): void {
  router.post("/internal/v1/media/intents", controller.createIntent);
  router.post("/internal/v1/media/delete", controller.deleteMany);
  router.get("/internal/v1/media/:mediaId", controller.get);
  router.post("/internal/v1/media/:mediaId/signed-url", controller.signedUrl);
  router.post("/internal/v1/media/:mediaId/review", controller.review);
  router.post("/internal/v1/media/:mediaId/complete", controller.complete);
  router.post("/internal/v1/media/:mediaId/audio-fingerprint", controller.audioFingerprint);
}
