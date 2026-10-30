import { schema } from "@nantty/fastify-platform";

import type { Handler } from "../../../types/handlerContext.type.js";
import type { Page } from "../../../types/pagination.type.js";
import { clampPageSize } from "../../../utils/cursor.util.js";
import type { RouteFactory } from "../../../utils/route.util.js";
import type { ConnectionEntry } from "../../follows/models/follow.model.js";
import type { BlockUserCommand } from "../commands/blockUser/blockUser.command.js";
import type { UnblockUserCommand } from "../commands/unblockUser/unblockUser.command.js";
import type { ListBlockedUsersQuery } from "../queries/listBlockedUsers/listBlockedUsers.query.js";

export interface BlocksHandlers {
  readonly blockUser: Handler<BlockUserCommand, void>;
  readonly unblockUser: Handler<UnblockUserCommand, void>;
  readonly listBlockedUsers: Handler<ListBlockedUsersQuery, Page<ConnectionEntry>>;
}

const userParams = schema.object({ userId: schema.string().uuid() });
const pageQuery = schema.object({ cursor: schema.string().uuid().optional(), limit: schema.coerce.number().int().min(1).max(100).optional() });

export function createBlocksController(route: RouteFactory, handlers: BlocksHandlers) {
  return {
    blockUser: route({ authentication: "required", params: userParams }, ({ principal, params }) => handlers.blockUser({ blockerId: principal.accountId, targetId: params.userId })),
    unblockUser: route({ authentication: "required", params: userParams }, ({ principal, params }) => handlers.unblockUser({ blockerId: principal.accountId, targetId: params.userId })),
    listBlockedUsers: route({ authentication: "required", query: pageQuery }, ({ principal, query }) =>
      handlers.listBlockedUsers({ viewerId: principal.accountId, cursor: query.cursor, limit: clampPageSize(query.limit) })),
  };
}
