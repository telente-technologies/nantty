import type { FastifyInstance } from "fastify";

import type { createUploadsController } from "../controllers/uploads.controller.js";
import { invokeLegacyRoute } from "../../../routes/routeAdapter.js";

export function registerUploadsRoutes(app: FastifyInstance, controller: ReturnType<typeof createUploadsController>): void {
  app.post("/api/v1/media/uploads", (request, reply) => invokeLegacyRoute(reply, request, controller.create));
  app.get("/api/v1/media/uploads/:uploadId", (request, reply) => invokeLegacyRoute(reply, request, controller.status));
  app.delete("/api/v1/media/uploads/:uploadId", (request, reply) => invokeLegacyRoute(reply, request, controller.abort));
  app.put("/api/v1/media/uploads/:uploadId/chunks/:chunkIndex", (request, reply) => invokeLegacyRoute(reply, request, controller.uploadChunk));
  app.get("/api/v1/media/uploads/:uploadId/chunks/:chunkIndex/url", (request, reply) => invokeLegacyRoute(reply, request, controller.chunkUrl));
  app.post("/api/v1/media/uploads/:uploadId/chunks/urls", (request, reply) => invokeLegacyRoute(reply, request, controller.chunkUrls));
  app.post("/api/v1/media/uploads/:uploadId/complete", (request, reply) => invokeLegacyRoute(reply, request, controller.complete));
  app.post("/api/v1/media/:mediaId/complete", (request, reply) => invokeLegacyRoute(reply, request, controller.completeByMedia));
  app.get("/api/v1/media/:mediaId", (request, reply) => invokeLegacyRoute(reply, request, controller.getMedia));
}
