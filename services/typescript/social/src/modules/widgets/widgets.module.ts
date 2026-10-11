import type { HttpRouter } from "@zudojs/http";

import type { HandlerContext } from "../../types/handlerContext.type.js";
import type { RouteFactory } from "../../utils/route.util.js";
import { createWidgetsController } from "./controllers/widgets.controller.js";
import { createListWidgetStoriesHandler } from "./queries/listWidgetStories/listWidgetStories.handler.js";
import { registerWidgetsRoutes } from "./routes/widgets.routes.js";

export function mountWidgetsModule(router: HttpRouter, route: RouteFactory, context: HandlerContext): void {
  registerWidgetsRoutes(router, createWidgetsController(route, { listWidgetStories: createListWidgetStoriesHandler(context) }));
}
