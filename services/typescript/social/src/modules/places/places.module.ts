import type { HttpRouter } from "@zudojs/http";

import type { HandlerContext } from "../../types/handlerContext.type.js";
import type { RouteFactory } from "../../utils/route.util.js";
import { createPlacesController } from "./controllers/places.controller.js";
import { createSearchPlacesHandler } from "./queries/searchPlaces/searchPlaces.handler.js";
import { registerPlacesRoutes } from "./routes/places.routes.js";
import { createBundledPlacesProvider } from "./services/bundledPlaces.service.js";

export function mountPlacesModule(router: HttpRouter, route: RouteFactory, context: HandlerContext): void {
  registerPlacesRoutes(router, createPlacesController(route, { searchPlaces: createSearchPlacesHandler(context.places ?? createBundledPlacesProvider()) }));
}
