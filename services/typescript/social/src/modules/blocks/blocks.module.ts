import type { HttpRouter } from "@nantty/fastify-platform";

import type { HandlerContext } from "../../types/handlerContext.type.js";
import type { RouteFactory } from "../../utils/route.util.js";
import { createBlockUserHandler } from "./commands/blockUser/blockUser.handler.js";
import { createUnblockUserHandler } from "./commands/unblockUser/unblockUser.handler.js";
import { createBlocksController } from "./controllers/blocks.controller.js";
import { createListBlockedUsersHandler } from "./queries/listBlockedUsers/listBlockedUsers.handler.js";
import { registerBlocksRoutes } from "./routes/blocks.routes.js";

export function mountBlocksModule(router: HttpRouter, route: RouteFactory, context: HandlerContext): void {
  registerBlocksRoutes(router, createBlocksController(route, {
    blockUser: createBlockUserHandler(context),
    unblockUser: createUnblockUserHandler(context),
    listBlockedUsers: createListBlockedUsersHandler(context),
  }));
}
