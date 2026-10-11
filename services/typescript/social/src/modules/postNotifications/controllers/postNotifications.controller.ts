import { requireInternalToken } from "../../../middlewares/internalToken.middleware.js";
import type { Handler } from "../../../types/handlerContext.type.js";
import type { RouteFactory } from "../../../utils/route.util.js";
import type { SetPostNotificationsCommand } from "../commands/setPostNotifications/setPostNotifications.command.js";
import type { PostNotificationsView } from "../models/postNotifications.model.js";
import type { GetPostNotificationsQuery } from "../queries/getPostNotifications/getPostNotifications.query.js";
import type { SubscriberPage } from "../queries/listPostNotificationSubscribers/listPostNotificationSubscribers.handler.js";
import type { ListPostNotificationSubscribersQuery } from "../queries/listPostNotificationSubscribers/listPostNotificationSubscribers.query.js";
import { setPostNotificationsBodySchema, subscriberParamsSchema, subscriberQuerySchema, targetParamsSchema } from "../validators/postNotifications.validator.js";

export interface PostNotificationsHandlers {
  readonly getPostNotifications: Handler<GetPostNotificationsQuery, PostNotificationsView>;
  readonly setPostNotifications: Handler<SetPostNotificationsCommand, PostNotificationsView>;
  readonly listSubscribers: Handler<ListPostNotificationSubscribersQuery, SubscriberPage>;
}

const resolveTarget = (userId: string, accountId: string) => (userId === "me" ? accountId : userId);

export function createPostNotificationsController(route: RouteFactory, internalToken: string, handlers: PostNotificationsHandlers) {
  return {
    get: route({ authentication: "required", params: targetParamsSchema }, ({ principal, params }) =>
      handlers.getPostNotifications({ viewerId: principal.accountId, targetId: resolveTarget(params.userId, principal.accountId) })),
    set: route({ authentication: "required", params: targetParamsSchema, body: setPostNotificationsBodySchema }, ({ principal, params, body }) =>
      handlers.setPostNotifications({ followerId: principal.accountId, targetId: resolveTarget(params.userId, principal.accountId), level: body.level })),
    subscribers: requireInternalToken(internalToken, route({ authentication: "optional", params: subscriberParamsSchema, query: subscriberQuerySchema }, ({ params, query }) =>
      handlers.listSubscribers({ authorId: params.accountId, scope: query.scope, cursor: query.cursor, limit: query.limit ?? 200 }))),
  };
}
