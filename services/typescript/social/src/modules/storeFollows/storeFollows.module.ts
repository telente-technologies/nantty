import type { HttpRouter } from "@zudojs/http";

import type { HandlerContext } from "../../types/handlerContext.type.js";
import type { RouteFactory } from "../../utils/route.util.js";
import { createFollowStoreHandler } from "./commands/followStore/followStore.handler.js";
import { createUnfollowStoreHandler } from "./commands/unfollowStore/unfollowStore.handler.js";
import { createStoreFollowsController } from "./controllers/storeFollows.controller.js";
import { createGetStoreFollowStatusHandler } from "./queries/getStoreFollowStatus/getStoreFollowStatus.handler.js";
import { createListStoreFollowersHandler } from "./queries/listStoreFollowers/listStoreFollowers.handler.js";
import { registerStoreFollowsRoutes } from "./routes/storeFollows.routes.js";

export function mountStoreFollowsModule(router: HttpRouter, route: RouteFactory, context: HandlerContext, internalToken: string): void {
  registerStoreFollowsRoutes(router, createStoreFollowsController(route, {
    followStore: createFollowStoreHandler(context),
    unfollowStore: createUnfollowStoreHandler(context),
    listStoreFollowers: createListStoreFollowersHandler(context),
    getStoreFollowStatus: createGetStoreFollowStatusHandler(context),
  }, internalToken));
}
