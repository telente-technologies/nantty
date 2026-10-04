import type { HttpRouter } from "@zudojs/http";

import type { HandlerContext } from "../../types/handlerContext.type.js";
import type { RouteFactory } from "../../utils/route.util.js";
import { createInternalSourcesController } from "./controllers/internalSources.controller.js";
import { registerInternalSourcesRoutes } from "./routes/internalSources.routes.js";

export function mountInternalSourcesModule(router: HttpRouter, route: RouteFactory, context: HandlerContext, internalToken: string): void {
  registerInternalSourcesRoutes(router, createInternalSourcesController(route, internalToken, context));
}
