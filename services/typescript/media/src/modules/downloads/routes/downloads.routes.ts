import type { FastifyInstance } from "fastify";

import type { createDownloadsController } from "../controllers/downloads.controller.js";
import { invokeLegacyRoute } from "../../../routes/routeAdapter.js";

export function registerDownloadsRoutes(app: FastifyInstance, controller: ReturnType<typeof createDownloadsController>): void {
  app.post("/internal/v1/media/:mediaId/download-variant", (request, reply) => invokeLegacyRoute(reply, request, controller.requestVariant));
}
