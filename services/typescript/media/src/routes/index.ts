import type { HttpRouter } from "@zudojs/http";

import type { MediaDatabase } from "../databases/prisma.database.js";
import { mountInternalModule } from "../modules/internal/internal.module.js";
import { mountUploadsModule } from "../modules/uploads/uploads.module.js";
import type { HandlerContext } from "../types/handlerContext.type.js";
import type { RouteFactory } from "../utils/route.util.js";
import { registerHealthRoutes } from "./health.routes.js";

export function registerRoutes(router: HttpRouter, route: RouteFactory, context: HandlerContext, database: MediaDatabase): void {
  registerHealthRoutes(router, database, async () => {
    const ffmpeg = await context.transcoder.isAvailable();
    return { healthy: ffmpeg || context.config.ffmpeg.mode !== "required", ffmpeg, malwareScan: context.config.clamAv !== undefined, moderation: context.moderation !== undefined };
  });
  mountUploadsModule(router, route, context);
  mountInternalModule(router, route, context);
}
