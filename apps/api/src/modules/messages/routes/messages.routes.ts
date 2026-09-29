import type { HttpRouter } from "@zudojs/http";

import type { WebKit } from "../../../loaders/web.loader.js";
import { describeRoute } from "../../../utils/openapi.util.js";
import type { MessagesController } from "../controllers/messages.controller.js";
import {
  ConversationMessageParamsSchema,
  ConversationParamsSchema,
  ListConversationsQuerySchema,
  ListMessagesQuerySchema,
  SearchMessagesQuerySchema,
  SendMessageBodySchema,
  StartConversationBodySchema,
  UpdateConversationBodySchema,
} from "../validators/messages.validator.js";

const CONVERSATIONS = "/api/v1/conversations";
const TAG = "messages";

export function registerMessagesRoutes(router: HttpRouter, controller: MessagesController, web: WebKit): void {
  const chat = web.guard.requirePermission("messages:use");
  const byId = { params: ConversationParamsSchema };
  router.post(CONVERSATIONS, controller.startConversation, { ...chat, ...describeRoute(TAG, "Start or open a direct conversation", { body: StartConversationBodySchema }) });
  router.get(CONVERSATIONS, controller.listConversations, { ...chat, ...describeRoute(TAG, "List my conversations", { query: ListConversationsQuerySchema }) });
  router.get(`${CONVERSATIONS}/search`, controller.search, { ...chat, ...describeRoute(TAG, "Search messages and people", { query: SearchMessagesQuerySchema }) });
  router.get(`${CONVERSATIONS}/:id`, controller.getConversation, { ...chat, ...describeRoute(TAG, "Get a conversation", byId) });
  router.patch(`${CONVERSATIONS}/:id`, controller.updateConversation, {
    ...chat,
    ...describeRoute(TAG, "Rename, change the photo or set the disappearing-message timer", { ...byId, body: UpdateConversationBodySchema }),
  });
  router.get(`${CONVERSATIONS}/:id/messages`, controller.listMessages, { ...chat, ...describeRoute(TAG, "List messages", { ...byId, query: ListMessagesQuerySchema }) });
  router.post(`${CONVERSATIONS}/:id/messages`, controller.sendMessage, { ...chat, ...describeRoute(TAG, "Send a text message or voice note", { ...byId, body: SendMessageBodySchema }) });
  router.get(`${CONVERSATIONS}/:id/messages/:messageId/voice`, controller.downloadVoiceNote, {
    ...chat,
    ...describeRoute(TAG, "Play a voice note (participants only)", { params: ConversationMessageParamsSchema }),
  });
  router.post(`${CONVERSATIONS}/:id/read`, controller.markRead, { ...chat, ...describeRoute(TAG, "Mark a conversation read", byId) });
  router.get("/api/v1/messages/unread-count", controller.unreadCount, { ...chat, ...describeRoute(TAG, "Count unread messages") });
}
