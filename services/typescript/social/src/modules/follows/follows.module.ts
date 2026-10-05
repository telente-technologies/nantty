import type { HttpRouter } from "@zudojs/http";

import type { HandlerContext } from "../../types/handlerContext.type.js";
import type { RouteFactory } from "../../utils/route.util.js";
import { createFollowUserHandler } from "./commands/followUser/followUser.handler.js";
import { createRespondToFollowRequestHandler } from "./commands/respondToFollowRequest/respondToFollowRequest.handler.js";
import { createUnfollowUserHandler } from "./commands/unfollowUser/unfollowUser.handler.js";
import { createFollowsController } from "./controllers/follows.controller.js";
import { createGetFollowStatusHandler } from "./queries/getFollowStatus/getFollowStatus.handler.js";
import { createListFollowRequestsHandler } from "./queries/listFollowRequests/listFollowRequests.handler.js";
import { createListFollowersHandler } from "./queries/listFollowers/listFollowers.handler.js";
import { createListFollowingHandler } from "./queries/listFollowing/listFollowing.handler.js";
import { createListFollowedStoresHandler } from "../storeFollows/queries/listFollowedStores/listFollowedStores.handler.js";
import { createListConnectionsHandler } from "./queries/listConnections/listConnections.handler.js";
import { registerFollowsRoutes } from "./routes/follows.routes.js";

export function mountFollowsModule(router: HttpRouter, route: RouteFactory, context: HandlerContext): void {
  const controller = createFollowsController(route, {
    followUser: createFollowUserHandler(context),
    unfollowUser: createUnfollowUserHandler(context),
    respondToFollowRequest: createRespondToFollowRequestHandler(context),
    listFollowers: createListFollowersHandler(context),
    listFollowing: createListFollowingHandler(context),
    listFollowedStores: createListFollowedStoresHandler(context),
    listConnections: createListConnectionsHandler(context),
    listFollowRequests: createListFollowRequestsHandler(context),
    getFollowStatus: createGetFollowStatusHandler(context),
  });
  registerFollowsRoutes(router, controller);
}
