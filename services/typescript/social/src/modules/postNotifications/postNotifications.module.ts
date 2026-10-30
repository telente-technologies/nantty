import type { HttpRouter } from "@nantty/fastify-platform";

import type { HandlerContext } from "../../types/handlerContext.type.js";
import type { RouteFactory } from "../../utils/route.util.js";
import { createSetPostNotificationsHandler } from "./commands/setPostNotifications/setPostNotifications.handler.js";
import { createPostNotificationsController } from "./controllers/postNotifications.controller.js";
import { createGetPostNotificationsHandler } from "./queries/getPostNotifications/getPostNotifications.handler.js";
import { createListPostNotificationSubscribersHandler } from "./queries/listPostNotificationSubscribers/listPostNotificationSubscribers.handler.js";
import { registerPostNotificationsRoutes } from "./routes/postNotifications.routes.js";

export function mountPostNotificationsModule(router: HttpRouter, route: RouteFactory, context: HandlerContext, internalToken: string): void {
  registerPostNotificationsRoutes(router, createPostNotificationsController(route, internalToken, {
    getPostNotifications: createGetPostNotificationsHandler(context),
    setPostNotifications: createSetPostNotificationsHandler(context),
    listSubscribers: createListPostNotificationSubscribersHandler(context),
  }));
}
