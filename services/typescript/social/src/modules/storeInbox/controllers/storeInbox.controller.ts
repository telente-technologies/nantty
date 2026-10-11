import { requireInternalToken } from "../../../middlewares/internalToken.middleware.js";
import type { HandlerContext } from "../../../types/handlerContext.type.js";
import type { RouteFactory } from "../../../utils/route.util.js";
import { loadConversationViewForMember } from "../../conversations/services/conversationViewById.service.js";
import { resolveEncryptionRecipients } from "../../conversations/services/encryptionRecipients.service.js";
import { createSendMessageHandler } from "../../messages/commands/sendMessage/sendMessage.handler.js";
import { assertNoPlaintext, type OutgoingMessageInput } from "../../messages/services/messageValidation.service.js";
import { notFound } from "../../../errors/social.error.js";
import { createMarkStoreConversationReadHandler } from "../commands/markStoreConversationRead/markStoreConversationRead.handler.js";
import { createOpenStoreConversationHandler, openStoreConversationForBuyer } from "../commands/openStoreConversation/openStoreConversation.handler.js";
import { createSendStoreMessageHandler } from "../commands/sendStoreMessage/sendStoreMessage.handler.js";
import { createGetStoreConversationHandler } from "../queries/getStoreConversation/getStoreConversation.handler.js";
import { createListStoreConversationsHandler } from "../queries/listStoreConversations/listStoreConversations.handler.js";
import { storeInboxRepository } from "../repositories/storeInbox.repository.js";
import {
  buyerStoreMessageBodySchema, listStoreConversationsQuerySchema, openStoreConversationBodySchema, storeConversationParamsSchema, storeMessageBodySchema, storeParamsSchema, threadQuerySchema,
} from "../validators/storeInbox.validator.js";

type EncryptedBody = { readonly kind?: OutgoingMessageInput["kind"] | undefined; readonly encryption?: OutgoingMessageInput["encryption"]; readonly mediaId?: string | undefined; readonly durationSeconds?: number | undefined; readonly linkPreview?: string | null | undefined; readonly body?: unknown; readonly text?: unknown; readonly location?: unknown; readonly poll?: unknown; readonly document?: unknown; readonly sharedContent?: unknown };

function toOutgoingMessage(body: EncryptedBody): OutgoingMessageInput {
  return {
    kind: body.kind ?? "text", encryption: body.encryption, linkPreview: body.linkPreview,
    media: body.mediaId === undefined ? undefined : { mediaId: body.mediaId, durationSeconds: body.durationSeconds },
    plaintext: { text: body.body ?? body.text, location: body.location, poll: body.poll, document: body.document, sharedContent: body.sharedContent },
  };
}

export function createStoreInboxController(route: RouteFactory, internalToken: string, context: HandlerContext) {
  const list = createListStoreConversationsHandler(context);
  const get = createGetStoreConversationHandler(context);
  const send = createSendStoreMessageHandler(context);
  const sendAsBuyer = createSendMessageHandler(context);
  const read = createMarkStoreConversationReadHandler(context);
  const open = createOpenStoreConversationHandler(context);
  const internal = (handle: Parameters<typeof requireInternalToken>[1]) => requireInternalToken(internalToken, handle);
  return {
    list: internal(route({ authentication: "optional", params: storeParamsSchema, query: listStoreConversationsQuerySchema }, ({ params, query }) =>
      list({ storeId: params.storeId, filter: query.filter ?? "all", cursor: query.cursor, limit: query.limit ?? 50 }))),
    get: internal(route({ authentication: "optional", params: storeConversationParamsSchema, query: threadQuerySchema }, ({ params, query }) =>
      get({ storeId: params.storeId, conversationId: params.conversationId, viewerId: params.storeId, cursor: query.cursor, after: query.after, limit: query.limit ?? 50 }))),
    recipients: internal(route({ authentication: "optional", params: storeConversationParamsSchema }, async ({ params }) => {
      const conversation = await storeInboxRepository.findForStore(context.database.client, params.storeId, params.conversationId);
      if (conversation === null) throw notFound("CONVERSATION_NOT_FOUND", "That conversation could not be found.");
      return resolveEncryptionRecipients(context, conversation);
    })),
    reply: internal(route({ authentication: "optional", params: storeConversationParamsSchema, body: storeMessageBodySchema, successStatus: 201 }, ({ params, body }) =>
      send({ storeId: params.storeId, conversationId: params.conversationId, senderAccountId: body.senderAccountId, senderLabel: body.senderName, idempotencyKey: body.clientMessageId, message: toOutgoingMessage(body) }))),
    read: internal(route({ authentication: "optional", params: storeConversationParamsSchema }, ({ params }) => read({ storeId: params.storeId, conversationId: params.conversationId }))),
    open: internal(route({ authentication: "optional", params: storeParamsSchema, body: openStoreConversationBodySchema }, ({ params, body }) =>
      open({ storeId: params.storeId, buyerAccountId: body.buyerAccountId, orderId: body.orderId, orderNumber: body.orderNumber }))),
    buyerOpen: route({ authentication: "required", params: storeParamsSchema }, async ({ principal, params }) => {
      const conversation = await openStoreConversationForBuyer(context, params.storeId, principal.accountId);
      return loadConversationViewForMember(context, conversation.id, principal.accountId);
    }),
    buyerSend: route({ authentication: "required", params: storeParamsSchema, body: buyerStoreMessageBodySchema, successStatus: 201 }, async ({ principal, params, body, idempotencyKey }) => {
      const message = toOutgoingMessage(body);
      assertNoPlaintext(message.plaintext);
      const conversation = await openStoreConversationForBuyer(context, params.storeId, principal.accountId);
      return sendAsBuyer({ senderId: principal.accountId, conversationId: conversation.id, idempotencyKey, mentions: undefined, message });
    }),
  };
}
