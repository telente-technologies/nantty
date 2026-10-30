import type { FastifyInstance } from "fastify";

import type { MediaDatabase } from "../databases/prisma.database.js";
import { mountDownloadsModule } from "../modules/downloads/downloads.module.js";
import { mountInternalModule } from "../modules/internal/internal.module.js";
import { mountUploadsModule } from "../modules/uploads/uploads.module.js";
import type { HandlerContext } from "../types/handlerContext.type.js";
import type { RouteFactory } from "../utils/route.util.js";
import { checkRabbitMqConnections } from "../integrations/rabbitMqConnection.integration.js";
import { registerHealthRoutes } from "./health.routes.js";

export function registerRoutes(app: FastifyInstance, route: RouteFactory, context: HandlerContext, database: MediaDatabase): void {
  registerHealthRoutes(app, database, async () => {
    const ffmpeg = await context.transcoder.isAvailable();
    return { healthy: ffmpeg || context.config.ffmpeg.mode !== "required", ffmpeg, malwareScan: context.config.clamAv !== undefined, moderation: context.moderation !== undefined };
  }, context.config.rabbitMqUrl === "" ? async () => undefined : checkRabbitMqConnections);
  mountUploadsModule(app, route, context);
  mountInternalModule(app, route, context);
  mountDownloadsModule(app, route, context);
}
