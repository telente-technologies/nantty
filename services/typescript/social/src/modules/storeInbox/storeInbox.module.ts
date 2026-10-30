import type { HttpRouter } from "@nantty/fastify-platform";

import type { HandlerContext } from "../../types/handlerContext.type.js";
import type { RouteFactory } from "../../utils/route.util.js";
import { createStoreInboxController } from "./controllers/storeInbox.controller.js";
import { registerStoreInboxRoutes } from "./routes/storeInbox.routes.js";

export function mountStoreInboxModule(router: HttpRouter, route: RouteFactory, context: HandlerContext, internalToken: string): void {
  registerStoreInboxRoutes(router, createStoreInboxController(route, internalToken, context));
}
