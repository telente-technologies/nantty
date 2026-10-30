import type { HttpRouter } from "@nantty/fastify-platform";

import type { HandlerContext } from "../../types/handlerContext.type.js";
import type { RouteFactory } from "../../utils/route.util.js";
import { createExploreController } from "./controllers/explore.controller.js";
import { registerExploreRoutes } from "./routes/explore.routes.js";

export function mountExploreModule(router: HttpRouter, route: RouteFactory, context: HandlerContext): void {
  registerExploreRoutes(router, createExploreController(route, context));
}
