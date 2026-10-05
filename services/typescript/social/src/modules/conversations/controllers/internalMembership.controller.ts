import { schema } from "@zudojs/schema";

import { requireInternalToken } from "../../../middlewares/internalToken.middleware.js";
import type { Handler } from "../../../types/handlerContext.type.js";
import type { RouteFactory } from "../../../utils/route.util.js";
import type { InternalMembershipQuery, InternalMembershipView } from "../queries/getInternalMembership/getInternalMembership.handler.js";

const membershipParamsSchema = schema.object({ conversationId: schema.string().uuid(), accountId: schema.string().uuid() });

export function createInternalMembershipController(route: RouteFactory, getMembership: Handler<InternalMembershipQuery, InternalMembershipView>, internalToken: string) {
  return {
    membership: requireInternalToken(internalToken, route({ authentication: "optional", params: membershipParamsSchema }, ({ params }) => getMembership({ conversationId: params.conversationId, accountId: params.accountId }))),
  };
}
