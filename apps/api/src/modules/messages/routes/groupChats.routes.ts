import type { HttpRouter } from "@zudojs/http";

import type { WebKit } from "../../../loaders/web.loader.js";
import { describeRoute } from "../../../utils/openapi.util.js";
import type { GroupChatsController } from "../controllers/groupChats.controller.js";
import {
  AddMembersBodySchema,
  ConversationMemberParamsSchema,
  ConversationParamsSchema,
  CreateChannelBodySchema,
  CreateGroupBodySchema,
  MessageParamsSchema,
  MessageReactionParamsSchema,
  PromoteAdminBodySchema,
  ReactionBodySchema,
  StoreConversationsQuerySchema,
  StoreParamsSchema,
} from "../validators/messages.validator.js";

const CONVERSATIONS = "/api/v1/conversations";
const TAG = "messages";

export function registerGroupChatsRoutes(router: HttpRouter, controller: GroupChatsController, web: WebKit): void {
  const chat = web.guard.requirePermission("messages:use");
  const byId = { params: ConversationParamsSchema };
  const member = { params: ConversationMemberParamsSchema };
  router.post(`${CONVERSATIONS}/groups`, controller.createGroup, { ...chat, ...describeRoute(TAG, "Create a group chat", { body: CreateGroupBodySchema }) });
  router.get(`${CONVERSATIONS}/:id/members`, controller.listMembers, { ...chat, ...describeRoute(TAG, "List group or channel members", byId) });
  router.post(`${CONVERSATIONS}/:id/members`, controller.addMembers, { ...chat, ...describeRoute(TAG, "Add members to a group (admins)", { ...byId, body: AddMembersBodySchema }) });
  router.delete(`${CONVERSATIONS}/:id/members/:userId`, controller.removeMember, { ...chat, ...describeRoute(TAG, "Remove a member (admins)", member) });
  router.post(`${CONVERSATIONS}/:id/admins`, controller.promoteAdmin, { ...chat, ...describeRoute(TAG, "Promote a member to admin", { ...byId, body: PromoteAdminBodySchema }) });
  router.delete(`${CONVERSATIONS}/:id/admins/:userId`, controller.demoteAdmin, { ...chat, ...describeRoute(TAG, "Demote an admin", member) });
  router.post(`${CONVERSATIONS}/:id/leave`, controller.leave, { ...chat, ...describeRoute(TAG, "Leave a group or channel", byId) });
  router.post("/api/v1/channels", controller.createChannel, { ...chat, ...describeRoute(TAG, "Create a broadcast channel", { body: CreateChannelBodySchema }) });
  router.post("/api/v1/channels/:id/subscribe", controller.subscribeToChannel, { ...chat, ...describeRoute(TAG, "Subscribe to a channel", byId) });
  router.delete("/api/v1/channels/:id/subscribe", controller.unsubscribeFromChannel, { ...chat, ...describeRoute(TAG, "Unsubscribe from a channel", byId) });
  router.post("/api/v1/messages/:messageId/reactions", controller.addReaction, {
    ...chat,
    ...describeRoute(TAG, "React to a message", { params: MessageParamsSchema, body: ReactionBodySchema }),
  });
  router.delete("/api/v1/messages/:messageId/reactions/:emoji", controller.removeReaction, {
    ...chat,
    ...describeRoute(TAG, "Remove my reaction", { params: MessageReactionParamsSchema }),
  });
  router.post("/api/v1/stores/:storeId/conversations", controller.startStoreConversation, {
    ...chat,
    ...describeRoute(TAG, "Start or open a business chat with a store", { params: StoreParamsSchema }),
  });
  router.get("/api/v1/seller/conversations", controller.listStoreConversations, {
    ...web.guard.requirePermission("stores:manage"),
    ...describeRoute(TAG, "Store inbox: customer chats handled by store members", { query: StoreConversationsQuerySchema }),
  });
  router.post("/api/v1/realtime/tickets", controller.issueRealtimeTicket, { ...chat, ...describeRoute(TAG, "Issue a one-time WebSocket ticket") });
}
