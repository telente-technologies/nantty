import type { FastifyInstance } from "fastify";

import type { createInternalController } from "../controllers/internal.controller.js";
import { invokeLegacyRoute } from "../../../routes/routeAdapter.js";

export function registerInternalRoutes(app: FastifyInstance, controller: ReturnType<typeof createInternalController>): void {
  app.post("/internal/v1/media/intents", (request, reply) => invokeLegacyRoute(reply, request, controller.createIntent));
  app.post("/internal/v1/media/delete", (request, reply) => invokeLegacyRoute(reply, request, controller.deleteMany));
  app.get("/internal/v1/media/:mediaId", (request, reply) => invokeLegacyRoute(reply, request, controller.get));
  app.post("/internal/v1/media/:mediaId/signed-url", (request, reply) => invokeLegacyRoute(reply, request, controller.signedUrl));
  app.post("/internal/v1/media/:mediaId/review", (request, reply) => invokeLegacyRoute(reply, request, controller.review));
  app.post("/internal/v1/media/:mediaId/complete", (request, reply) => invokeLegacyRoute(reply, request, controller.complete));
  app.post("/internal/v1/media/:mediaId/audio-fingerprint", (request, reply) => invokeLegacyRoute(reply, request, controller.audioFingerprint));
}
