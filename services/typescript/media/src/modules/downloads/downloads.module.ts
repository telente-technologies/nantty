import type { HttpRouter } from "@zudojs/http";

import type { HandlerContext } from "../../types/handlerContext.type.js";
import type { RouteFactory } from "../../utils/route.util.js";
import { createRequestDownloadVariantHandler } from "./commands/requestDownloadVariant/requestDownloadVariant.handler.js";
import { createDownloadsController } from "./controllers/downloads.controller.js";
import { registerDownloadsRoutes } from "./routes/downloads.routes.js";

export function mountDownloadsModule(router: HttpRouter, route: RouteFactory, context: HandlerContext): void {
  registerDownloadsRoutes(router, createDownloadsController(route, { requestDownloadVariant: createRequestDownloadVariantHandler(context) }));
}
