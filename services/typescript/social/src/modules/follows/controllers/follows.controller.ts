import type { Handler } from "../../../types/handlerContext.type.js";
import { clampPageSize } from "../../../utils/cursor.util.js";
import type { Page } from "../../../types/pagination.type.js";
import { followRequestParamsSchema, connectionListQuerySchema, pageQuerySchema, userIdParamsSchema } from "../validators/follows.validator.js";
import type { RouteFactory } from "../../../utils/route.util.js";
import type { RespondToFollowRequestCommand } from "../commands/respondToFollowRequest/respondToFollowRequest.command.js";
import type { FollowUserCommand } from "../commands/followUser/followUser.command.js";
import type { UnfollowUserCommand } from "../commands/unfollowUser/unfollowUser.command.js";
import type { ConnectionEntry, FollowRequestView, FollowResult, FollowStatusView } from "../models/follow.model.js";
import type { GetFollowStatusQuery } from "../queries/getFollowStatus/getFollowStatus.query.js";
import type { ListFollowersQuery } from "../queries/listFollowers/listFollowers.query.js";
import type { ListFollowingQuery } from "../queries/listFollowing/listFollowing.query.js";
import type { ListFollowRequestsQuery } from "../queries/listFollowRequests/listFollowRequests.query.js";

export interface FollowsHandlers {
  readonly followUser: Handler<FollowUserCommand, FollowResult>;
  readonly unfollowUser: Handler<UnfollowUserCommand, void>;
  readonly respondToFollowRequest: Handler<RespondToFollowRequestCommand, void>;
  readonly listFollowers: Handler<ListFollowersQuery, Page<ConnectionEntry>>;
  readonly listFollowing: Handler<ListFollowingQuery, Page<ConnectionEntry>>;
  readonly listFollowRequests: Handler<ListFollowRequestsQuery, Page<FollowRequestView>>;
  readonly getFollowStatus: Handler<GetFollowStatusQuery, FollowStatusView>;
}

const resolveAccountId = (userId: string, principalAccountId: string | undefined): string => (userId === "me" ? (principalAccountId ?? userId) : userId);

export function createFollowsController(route: RouteFactory, handlers: FollowsHandlers) {
  return {
    followUser: route({ authentication: "required", params: userIdParamsSchema }, ({ principal, params }) => handlers.followUser({ followerId: principal.accountId, targetId: params.userId })),
    unfollowUser: route({ authentication: "required", params: userIdParamsSchema }, ({ principal, params }) => handlers.unfollowUser({ followerId: principal.accountId, targetId: params.userId })),
    acceptFollowRequest: route({ authentication: "required", params: followRequestParamsSchema }, ({ principal, params }) => handlers.respondToFollowRequest({ followeeId: principal.accountId, requestId: params.requestId, decision: "accept" })),
    rejectFollowRequest: route({ authentication: "required", params: followRequestParamsSchema }, ({ principal, params }) => handlers.respondToFollowRequest({ followeeId: principal.accountId, requestId: params.requestId, decision: "reject" })),
    listFollowRequests: route({ authentication: "required", query: pageQuerySchema }, ({ principal, query }) =>
      handlers.listFollowRequests({ followeeId: principal.accountId, cursor: query.cursor, limit: clampPageSize(query.limit) })),
    listFollowers: route({ authentication: "optional", params: userIdParamsSchema, query: connectionListQuerySchema }, ({ principal, params, query }) =>
      handlers.listFollowers({ viewerId: principal?.accountId, ownerId: resolveAccountId(params.userId, principal?.accountId), searchTerm: query.q, cursor: query.cursor, limit: clampPageSize(query.limit) })),
    listFollowing: route({ authentication: "optional", params: userIdParamsSchema, query: connectionListQuerySchema }, ({ principal, params, query }) =>
      handlers.listFollowing({ viewerId: principal?.accountId, ownerId: resolveAccountId(params.userId, principal?.accountId), searchTerm: query.q, cursor: query.cursor, limit: clampPageSize(query.limit) })),
    getFollowStatus: route({ authentication: "optional", params: userIdParamsSchema }, ({ principal, params }) =>
      handlers.getFollowStatus({ viewerId: principal?.accountId, targetId: resolveAccountId(params.userId, principal?.accountId) })),
  };
}
