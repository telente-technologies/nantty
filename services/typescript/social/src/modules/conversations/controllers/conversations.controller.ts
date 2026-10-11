import type { Handler } from "../../../types/handlerContext.type.js";
import type { Page } from "../../../types/pagination.type.js";
import { clampPageSize } from "../../../utils/cursor.util.js";
import type { RouteFactory } from "../../../utils/route.util.js";
import type { AcceptMessageRequestCommand } from "../commands/acceptMessageRequest/acceptMessageRequest.command.js";
import type { AddGroupMembersCommand } from "../commands/addGroupMembers/addGroupMembers.command.js";
import type { BlockConversationPeerCommand } from "../commands/blockConversationPeer/blockConversationPeer.command.js";
import type { CreateGroupConversationCommand } from "../commands/createGroupConversation/createGroupConversation.command.js";
import type { DeleteConversationCommand } from "../commands/deleteConversation/deleteConversation.command.js";
import type { LeaveConversationCommand } from "../commands/leaveConversation/leaveConversation.command.js";
import type { MarkConversationNotSpamCommand } from "../commands/markConversationNotSpam/markConversationNotSpam.command.js";
import type { MarkConversationReadCommand } from "../commands/markConversationRead/markConversationRead.command.js";
import type { MuteConversationCommand } from "../commands/muteConversation/muteConversation.command.js";
import type { RemoveGroupMemberCommand } from "../commands/removeGroupMember/removeGroupMember.command.js";
import type { RestrictConversationCommand } from "../commands/restrictConversation/restrictConversation.command.js";
import type { SetGroupAdminCommand } from "../commands/setGroupAdmin/setGroupAdmin.command.js";
import type { StartDirectConversationCommand } from "../commands/startDirectConversation/startDirectConversation.command.js";
import type { UpdateConversationCommand } from "../commands/updateConversation/updateConversation.command.js";
import type { ConversationMemberView, ConversationView } from "../models/conversation.model.js";
import type { GetConversationQuery } from "../queries/getConversation/getConversation.query.js";
import type { ListConversationMembersQuery } from "../queries/listConversationMembers/listConversationMembers.query.js";
import type { ListConversationsQuery } from "../queries/listConversations/listConversations.query.js";
import type { ChatSearchResults } from "../queries/searchConversations/searchConversations.handler.js";
import type { SearchConversationsQuery } from "../queries/searchConversations/searchConversations.query.js";
import type { GetEncryptionRecipientsQuery } from "../queries/getEncryptionRecipients/getEncryptionRecipients.query.js";
import type { EncryptionRecipients } from "../services/encryptionRecipients.service.js";
import { addMembersBodySchema, adminBodySchema, conversationParamsSchema, createGroupBodySchema, listConversationsQuerySchema, memberParamsSchema, muteBodySchema, searchQuerySchema, startConversationBodySchema, updateConversationBodySchema } from "../validators/conversations.validator.js";

export interface ConversationsHandlers {
  readonly getEncryptionRecipients: Handler<GetEncryptionRecipientsQuery, EncryptionRecipients>;
  readonly startDirectConversation: Handler<StartDirectConversationCommand, ConversationView>;
  readonly createGroupConversation: Handler<CreateGroupConversationCommand, ConversationView>;
  readonly acceptMessageRequest: Handler<AcceptMessageRequestCommand, ConversationView>;
  readonly deleteConversation: Handler<DeleteConversationCommand, void>;
  readonly blockConversationPeer: Handler<BlockConversationPeerCommand, void>;
  readonly markConversationNotSpam: Handler<MarkConversationNotSpamCommand, ConversationView>;
  readonly restrictConversation: Handler<RestrictConversationCommand, void>;
  readonly muteConversation: Handler<MuteConversationCommand, { readonly mutedUntil: string | null }>;
  readonly markConversationRead: Handler<MarkConversationReadCommand, void>;
  readonly updateConversation: Handler<UpdateConversationCommand, ConversationView>;
  readonly addGroupMembers: Handler<AddGroupMembersCommand, ConversationMemberView[]>;
  readonly removeGroupMember: Handler<RemoveGroupMemberCommand, void>;
  readonly setGroupAdmin: Handler<SetGroupAdminCommand, void>;
  readonly leaveConversation: Handler<LeaveConversationCommand, void>;
  readonly listConversations: Handler<ListConversationsQuery, Page<ConversationView>>;
  readonly getConversation: Handler<GetConversationQuery, ConversationView>;
  readonly listConversationMembers: Handler<ListConversationMembersQuery, ConversationMemberView[]>;
  readonly searchConversations: Handler<SearchConversationsQuery, ChatSearchResults>;
}

export function createConversationsController(route: RouteFactory, handlers: ConversationsHandlers) {
  const idOnly = { authentication: "required", params: conversationParamsSchema } as const;
  return {
    list: route({ authentication: "required", query: listConversationsQuerySchema }, ({ principal, query }) =>
      handlers.listConversations({ viewerId: principal.accountId, folder: query.folder ?? "chats", filter: query.filter ?? "all", cursor: query.cursor, limit: clampPageSize(query.limit) })),
    search: route({ authentication: "required", query: searchQuerySchema }, ({ principal, query }) => handlers.searchConversations({ viewerId: principal.accountId, term: query.q })),
    start: route({ authentication: "required", body: startConversationBodySchema, successStatus: 201 }, ({ principal, body }) => handlers.startDirectConversation({ senderId: principal.accountId, peerId: body.userId })),
    createGroup: route({ authentication: "required", body: createGroupBodySchema, successStatus: 201 }, ({ principal, body }) =>
      handlers.createGroupConversation({ creatorId: principal.accountId, plaintextName: body.name, encryptedAttributes: body.encryptedAttributes, photoMediaId: body.photoMediaId, memberIds: body.memberIds })),
    get: route(idOnly, ({ principal, params }) => handlers.getConversation({ viewerId: principal.accountId, conversationId: params.conversationId })),
    update: route({ ...idOnly, body: updateConversationBodySchema }, ({ principal, params, body }) =>
      handlers.updateConversation({ viewerId: principal.accountId, conversationId: params.conversationId, name: body.name, encryptedAttributes: body.encryptedAttributes, photoMediaId: body.photoMediaId, disappearingMessagesSeconds: body.disappearingMessagesSeconds, onlyAdminsCanMentionAll: body.onlyAdminsCanMentionAll })),
    remove: route(idOnly, ({ principal, params }) => handlers.deleteConversation({ viewerId: principal.accountId, conversationId: params.conversationId })),
    accept: route(idOnly, ({ principal, params }) => handlers.acceptMessageRequest({ viewerId: principal.accountId, conversationId: params.conversationId })),
    block: route(idOnly, ({ principal, params }) => handlers.blockConversationPeer({ viewerId: principal.accountId, conversationId: params.conversationId })),
    notSpam: route(idOnly, ({ principal, params }) => handlers.markConversationNotSpam({ viewerId: principal.accountId, conversationId: params.conversationId })),
    restrict: route(idOnly, ({ principal, params }) => handlers.restrictConversation({ viewerId: principal.accountId, conversationId: params.conversationId })),
    mute: route({ ...idOnly, body: muteBodySchema }, ({ principal, params, body }) => handlers.muteConversation({ viewerId: principal.accountId, conversationId: params.conversationId, duration: body.duration })),
    read: route(idOnly, ({ principal, params }) => handlers.markConversationRead({ viewerId: principal.accountId, conversationId: params.conversationId })),
    leave: route(idOnly, ({ principal, params }) => handlers.leaveConversation({ viewerId: principal.accountId, conversationId: params.conversationId })),
    recipients: route(idOnly, ({ principal, params }) => handlers.getEncryptionRecipients({ viewerId: principal.accountId, conversationId: params.conversationId })),
    members: route(idOnly, ({ principal, params }) => handlers.listConversationMembers({ viewerId: principal.accountId, conversationId: params.conversationId })),
    addMembers: route({ ...idOnly, body: addMembersBodySchema }, ({ principal, params, body }) => handlers.addGroupMembers({ actorId: principal.accountId, conversationId: params.conversationId, userIds: body.userIds })),
    removeMember: route({ authentication: "required", params: memberParamsSchema }, ({ principal, params }) => handlers.removeGroupMember({ actorId: principal.accountId, conversationId: params.conversationId, userId: params.userId })),
    grantAdmin: route({ ...idOnly, body: adminBodySchema }, ({ principal, params, body }) => handlers.setGroupAdmin({ actorId: principal.accountId, conversationId: params.conversationId, userId: body.userId, isAdmin: true })),
    revokeAdmin: route({ authentication: "required", params: memberParamsSchema }, ({ principal, params }) => handlers.setGroupAdmin({ actorId: principal.accountId, conversationId: params.conversationId, userId: params.userId, isAdmin: false })),
  };
}
