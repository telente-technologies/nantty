import type { FastifyInstance } from "fastify";

import type { HandlerContext } from "../../types/handlerContext.type.js";
import type { RouteFactory } from "../../utils/route.util.js";
import { createRequestDownloadVariantHandler } from "./commands/requestDownloadVariant/requestDownloadVariant.handler.js";
import { createDownloadsController } from "./controllers/downloads.controller.js";
import { registerDownloadsRoutes } from "./routes/downloads.routes.js";

export function mountDownloadsModule(app: FastifyInstance, route: RouteFactory, context: HandlerContext): void {
  registerDownloadsRoutes(app, createDownloadsController(route, { requestDownloadVariant: createRequestDownloadVariantHandler(context) }));
}
