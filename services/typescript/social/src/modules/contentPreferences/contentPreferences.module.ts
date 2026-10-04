import type { HttpRouter } from "@zudojs/http";

import type { HandlerContext } from "../../types/handlerContext.type.js";
import type { RouteFactory } from "../../utils/route.util.js";
import { createUpdateContentPreferencesHandler } from "./commands/updateContentPreferences/updateContentPreferences.handler.js";
import { createContentPreferencesController } from "./controllers/contentPreferences.controller.js";
import { createGetContentPreferencesHandler } from "./queries/getContentPreferences/getContentPreferences.handler.js";
import { registerContentPreferencesRoutes } from "./routes/contentPreferences.routes.js";

export function mountContentPreferencesModule(router: HttpRouter, route: RouteFactory, context: HandlerContext): void {
  registerContentPreferencesRoutes(router, createContentPreferencesController(route, {
    getContentPreferences: createGetContentPreferencesHandler(context),
    updateContentPreferences: createUpdateContentPreferencesHandler(context),
  }));
}
