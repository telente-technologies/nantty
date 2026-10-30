import type { HttpRouter } from "@nantty/fastify-platform";

import type { HandlerContext } from "../../types/handlerContext.type.js";
import type { RouteFactory } from "../../utils/route.util.js";
import { createDigestsController } from "./controllers/digests.controller.js";
import { createListDigestPageHandler } from "./queries/listDigestPage/listDigestPage.handler.js";
import { registerDigestsRoutes } from "./routes/digests.routes.js";

export function mountDigestsModule(router: HttpRouter, route: RouteFactory, context: HandlerContext, internalToken: string): void {
  registerDigestsRoutes(router, createDigestsController(route, internalToken, createListDigestPageHandler(context)));
}
