import type { HttpRouter } from "@nantty/fastify-platform";

import type { HandlerContext } from "../../types/handlerContext.type.js";
import type { RouteFactory } from "../../utils/route.util.js";
import { createRequestPostMediaDownloadHandler } from "./commands/requestPostMediaDownload/requestPostMediaDownload.handler.js";
import { createUpdateDownloadSettingsHandler } from "./commands/updateDownloadSettings/updateDownloadSettings.handler.js";
import { createDownloadsController } from "./controllers/downloads.controller.js";
import { createGetDownloadSettingsHandler } from "./queries/getDownloadSettings/getDownloadSettings.handler.js";
import { registerDownloadsRoutes } from "./routes/downloads.routes.js";

export function mountDownloadsModule(router: HttpRouter, route: RouteFactory, context: HandlerContext): void {
  registerDownloadsRoutes(router, createDownloadsController(route, {
    requestPostMediaDownload: createRequestPostMediaDownloadHandler(context),
    getDownloadSettings: createGetDownloadSettingsHandler(context),
    updateDownloadSettings: createUpdateDownloadSettingsHandler(context),
  }));
}
