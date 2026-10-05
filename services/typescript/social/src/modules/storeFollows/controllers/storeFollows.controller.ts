import { requireInternalToken } from "../../../middlewares/internalToken.middleware.js";
import type { Handler } from "../../../types/handlerContext.type.js";
import type { Page } from "../../../types/pagination.type.js";
import { clampPageSize } from "../../../utils/cursor.util.js";
import type { RouteFactory } from "../../../utils/route.util.js";
import type { ConnectionEntry } from "../../follows/models/follow.model.js";
import type { FollowStoreCommand } from "../commands/followStore/followStore.command.js";
import type { UnfollowStoreCommand } from "../commands/unfollowStore/unfollowStore.command.js";
import type { StoreFollowState } from "../models/storeFollow.model.js";
import type { GetStoreFollowStatusQuery } from "../queries/getStoreFollowStatus/getStoreFollowStatus.query.js";
import type { ListStoreFollowersQuery } from "../queries/listStoreFollowers/listStoreFollowers.query.js";
import { followStatsQuerySchema, storeFollowersQuerySchema, storeIdParamsSchema } from "../validators/storeFollows.validator.js";

export interface StoreFollowsHandlers {
  readonly followStore: Handler<FollowStoreCommand, StoreFollowState>;
  readonly unfollowStore: Handler<UnfollowStoreCommand, void>;
  readonly listStoreFollowers: Handler<ListStoreFollowersQuery, Page<ConnectionEntry>>;
  readonly getStoreFollowStatus: Handler<GetStoreFollowStatusQuery, StoreFollowState>;
}

export function createStoreFollowsController(route: RouteFactory, handlers: StoreFollowsHandlers, internalToken: string) {
  return {
    follow: route({ authentication: "required", params: storeIdParamsSchema }, ({ principal, params }) => handlers.followStore({ followerId: principal.accountId, storeId: params.storeId })),
    unfollow: route({ authentication: "required", params: storeIdParamsSchema }, ({ principal, params }) => handlers.unfollowStore({ followerId: principal.accountId, storeId: params.storeId })),
    followers: route({ authentication: "optional", params: storeIdParamsSchema, query: storeFollowersQuerySchema }, ({ principal, params, query }) =>
      handlers.listStoreFollowers({ viewerId: principal?.accountId, storeId: params.storeId, cursor: query.cursor, limit: clampPageSize(query.limit) })),
    status: route({ authentication: "optional", params: storeIdParamsSchema }, ({ principal, params }) => handlers.getStoreFollowStatus({ viewerId: principal?.accountId, storeId: params.storeId })),
    internalStats: requireInternalToken(internalToken, route({ authentication: "optional", params: storeIdParamsSchema, query: followStatsQuerySchema }, ({ params, query }) =>
      handlers.getStoreFollowStatus({ viewerId: query.viewerId, storeId: params.storeId }))),
  };
}
