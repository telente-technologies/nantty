import type { HttpRouter } from "@nantty/fastify-platform";

import type { HandlerContext } from "../../types/handlerContext.type.js";
import type { RouteFactory } from "../../utils/route.util.js";
import { createCreateSaveCollectionHandler } from "./commands/createSaveCollection/createSaveCollection.handler.js";
import { createMoveSavedItemHandler } from "./commands/moveSavedItem/moveSavedItem.handler.js";
import { createSaveItemHandler } from "./commands/saveItem/saveItem.handler.js";
import { createUnsaveItemHandler } from "./commands/unsaveItem/unsaveItem.handler.js";
import { createSavesController } from "./controllers/saves.controller.js";
import { createListSaveCollectionsHandler } from "./queries/listSaveCollections/listSaveCollections.handler.js";
import { createListSavedItemsHandler } from "./queries/listSavedItems/listSavedItems.handler.js";
import { registerSavesRoutes } from "./routes/saves.routes.js";

export function mountSavesModule(router: HttpRouter, route: RouteFactory, context: HandlerContext): void {
  registerSavesRoutes(router, createSavesController(route, {
    saveItem: createSaveItemHandler(context),
    unsaveItem: createUnsaveItemHandler(context),
    createSaveCollection: createCreateSaveCollectionHandler(context),
    moveSavedItem: createMoveSavedItemHandler(context),
    listSavedItems: createListSavedItemsHandler(context),
    listSaveCollections: createListSaveCollectionsHandler(context),
  }));
}
