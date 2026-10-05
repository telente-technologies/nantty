import { requireInternalToken } from "../../../middlewares/internalToken.middleware.js";
import type { HandlerContext } from "../../../types/handlerContext.type.js";
import type { RouteFactory } from "../../../utils/route.util.js";
import { createMarkStoreConversationReadHandler } from "../commands/markStoreConversationRead/markStoreConversationRead.handler.js";
import { createOpenStoreConversationHandler, openStoreConversationRow } from "../commands/openStoreConversation/openStoreConversation.handler.js";
import { createSendStoreMessageHandler } from "../commands/sendStoreMessage/sendStoreMessage.handler.js";
import { createGetStoreConversationHandler } from "../queries/getStoreConversation/getStoreConversation.handler.js";
import { createListStoreConversationsHandler } from "../queries/listStoreConversations/listStoreConversations.handler.js";
import {
  buyerStoreMessageBodySchema, listStoreConversationsQuerySchema, openStoreConversationBodySchema, storeConversationParamsSchema, storeMessageBodySchema, storeParamsSchema,
} from "../validators/storeInbox.validator.js";

export function createStoreInboxController(route: RouteFactory, internalToken: string, context: HandlerContext) {
  const list = createListStoreConversationsHandler(context);
  const get = createGetStoreConversationHandler(context);
  const send = createSendStoreMessageHandler(context);
  const read = createMarkStoreConversationReadHandler(context);
  const open = createOpenStoreConversationHandler(context);
  const internal = (handle: Parameters<typeof requireInternalToken>[1]) => requireInternalToken(internalToken, handle);
  return {
    list: internal(route({ authentication: "optional", params: storeParamsSchema, query: listStoreConversationsQuerySchema }, ({ params, query }) =>
      list({ storeId: params.storeId, filter: query.filter ?? "all", text: query.q, cursor: query.cursor, limit: query.limit ?? 50 }))),
    get: internal(route({ authentication: "optional", params: storeConversationParamsSchema }, ({ params }) => get({ storeId: params.storeId, conversationId: params.conversationId }))),
    reply: internal(route({ authentication: "optional", params: storeConversationParamsSchema, body: storeMessageBodySchema, successStatus: 201 }, ({ params, body }) =>
      send({ storeId: params.storeId, conversationId: params.conversationId, senderId: params.storeId, senderLabel: body.senderName, actorName: body.senderName, body: body.body }))),
    read: internal(route({ authentication: "optional", params: storeConversationParamsSchema }, ({ params }) => read({ storeId: params.storeId, conversationId: params.conversationId }))),
    open: internal(route({ authentication: "optional", params: storeParamsSchema, body: openStoreConversationBodySchema }, ({ params, body }) =>
      open({ storeId: params.storeId, buyerAccountId: body.buyerAccountId, orderId: body.orderId, orderNumber: body.orderNumber }))),
    buyerSend: route({ authentication: "required", params: storeParamsSchema, body: buyerStoreMessageBodySchema, successStatus: 201 }, async ({ principal, params, body }) => {
      const conversation = await openStoreConversationRow(context.database.client, { storeId: params.storeId, buyerAccountId: principal.accountId });
      const summary = (await context.directory.findUserSummaries([principal.accountId])).get(principal.accountId);
      return send({ storeId: params.storeId, conversationId: conversation.id, senderId: principal.accountId, senderLabel: null, actorName: summary?.name ?? "Zudomart user", body: body.body });
    }),
  };
}
