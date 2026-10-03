import type { HttpRouter } from "@zudojs/http";

import type { HandlerContext } from "../../types/handlerContext.type.js";
import type { RouteFactory } from "../../utils/route.util.js";
import { createSearchController } from "./controllers/search.controller.js";
import { createSearchPeopleHandler } from "./queries/searchPeople/searchPeople.handler.js";
import { registerSearchRoutes } from "./routes/search.routes.js";

export function mountSearchModule(router: HttpRouter, route: RouteFactory, context: HandlerContext): void {
  registerSearchRoutes(router, createSearchController(route, { searchPeople: createSearchPeopleHandler(context) }));
}
