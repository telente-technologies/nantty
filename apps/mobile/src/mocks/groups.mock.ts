import { ApiError } from "@/errors/api.error";
import type {
  Conversation,
  ConversationMember,
  ConversationSettingsUpdate,
  Message,
  MessageReactionSummary,
  NewChannelInput,
  NewGroupConversationInput,
} from "@/types";

import { appendMockMessageAndUpdateConversation, findMockConversation, mockChatUser, mockConversations, mockMessagesByConversation } from "./chats.mock";
import { getSignedInMockUser } from "./fixtures.mock";
import { createMockRoute, type MockRoute } from "./registry.mock";

const membersByConversationId = new Map<string, ConversationMember[]>([
  [
    "g_owambe",
    [
      { user: mockChatUser("u_me"), role: "owner" },
      { user: mockChatUser("u_21"), role: "admin" },
      { user: mockChatUser("u_13"), role: "member" },
      { user: mockChatUser("u_10"), role: "member" },
      { user: mockChatUser("u_9"), role: "member" },
    ],
  ],
]);

const nextMockId = (prefix: string) => `${prefix}_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 5)}`;

const describeDisappearingSetting = (seconds: number | null | undefined) =>
  !seconds ? "turned off disappearing messages" : seconds >= 604_800 ? "set messages to disappear after 7 days" : "set messages to disappear after 24 hours";

function postSystemNotice(conversationId: string, text: string) {
  appendMockMessageAndUpdateConversation({
    id: nextMockId("m_sys"),
    conversationId,
    senderId: "system",
    text,
    createdAt: new Date().toISOString(),
    kind: "system",
  });
}

function replaceMockConversation(conversationId: string, change: (current: Conversation) => Conversation) {
  const index = mockConversations.findIndex((c) => c.id === conversationId);
  const updated = change(findMockConversation(conversationId));
  if (index >= 0) mockConversations[index] = updated;
  else mockConversations.push(updated);
  return updated;
}

function requireGroupAdmin(conversationId: string) {
  const myMembership = (membersByConversationId.get(conversationId) ?? []).find((member) => member.user.id === getSignedInMockUser().id);
  if (!myMembership || myMembership.role === "member") throw new ApiError(403, "Only group admins can do that", "NOT_GROUP_ADMIN");
}

const setMemberRole = (conversationId: string, userId: string, role: ConversationMember["role"]) =>
  membersByConversationId.set(
    conversationId,
    (membersByConversationId.get(conversationId) ?? []).map((member) => (member.user.id === userId ? { ...member, role } : member)),
  );

function toggleMockReaction(messageId: string, emoji: string, shouldReact: boolean): MessageReactionSummary[] {
  for (const [conversationId, messages] of mockMessagesByConversation) {
    const message = messages.find((m) => m.id === messageId);
    if (!message) continue;
    const reactions = [...(message.reactions ?? [])];
    const existing = reactions.find((r) => r.emoji === emoji);
    const updatedReactions = existing
      ? reactions
          .map((r) => (r.emoji === emoji && r.reactedByMe !== shouldReact ? { ...r, count: r.count + (shouldReact ? 1 : -1), reactedByMe: shouldReact } : r))
          .filter((r) => r.count > 0)
      : shouldReact
        ? [...reactions, { emoji, count: 1, reactedByMe: true }]
        : reactions;
    const updatedMessage: Message = { ...message, reactions: updatedReactions };
    mockMessagesByConversation.set(conversationId, messages.map((m) => (m.id === messageId ? updatedMessage : m)));
    return updatedReactions;
  }
  throw new ApiError(404, "Message not found", "MESSAGE_NOT_FOUND");
}

export const groupsMocks: MockRoute[] = [
  createMockRoute("POST", "/api/v1/conversations/groups", ({ body }) => {
    const input = body as NewGroupConversationInput;
    if (!input.name.trim()) throw new ApiError(422, "Give your group a name", "GROUP_NAME_REQUIRED");
    const me = getSignedInMockUser();
    const conversation: Conversation = {
      id: nextMockId("g"),
      peer: mockChatUser(input.memberIds[0] ?? "u_20"),
      lastMessage: `${me.name} created the group`,
      lastMessageAt: new Date().toISOString(),
      unread: 0,
      isFriend: true,
      kind: "group",
      title: input.name.trim(),
      photoUrl: null,
      memberCount: input.memberIds.length + 1,
      myRole: "owner",
      disappearingMessagesSeconds: null,
    };
    mockConversations.unshift(conversation);
    membersByConversationId.set(conversation.id, [
      { user: mockChatUser(me.id), role: "owner" },
      ...input.memberIds.map((userId) => ({ user: mockChatUser(userId), role: "member" as const })),
    ]);
    postSystemNotice(conversation.id, `${me.name} created the group`);
    return conversation;
  }),
  createMockRoute("GET", "/api/v1/conversations/:conversationId/members", ({ params }) => membersByConversationId.get(params.conversationId!) ?? []),
  createMockRoute("POST", "/api/v1/conversations/:conversationId/members", ({ params, body }) => {
    requireGroupAdmin(params.conversationId!);
    const existing = membersByConversationId.get(params.conversationId!) ?? [];
    const newMembers = (body as { userIds: string[] }).userIds
      .filter((userId) => !existing.some((member) => member.user.id === userId))
      .map((userId) => ({ user: mockChatUser(userId), role: "member" as const }));
    const updated = [...existing, ...newMembers];
    membersByConversationId.set(params.conversationId!, updated);
    replaceMockConversation(params.conversationId!, (c) => ({ ...c, memberCount: updated.length }));
    newMembers.forEach((member) => postSystemNotice(params.conversationId!, `${member.user.name} was added`));
    return updated;
  }),
  createMockRoute("DELETE", "/api/v1/conversations/:conversationId/members/:userId", ({ params }) => {
    requireGroupAdmin(params.conversationId!);
    const updated = (membersByConversationId.get(params.conversationId!) ?? []).filter((member) => member.user.id !== params.userId);
    membersByConversationId.set(params.conversationId!, updated);
    replaceMockConversation(params.conversationId!, (c) => ({ ...c, memberCount: updated.length }));
    postSystemNotice(params.conversationId!, `${mockChatUser(params.userId!).name} was removed`);
  }),
  createMockRoute("POST", "/api/v1/conversations/:conversationId/admins", ({ params, body }) => {
    requireGroupAdmin(params.conversationId!);
    setMemberRole(params.conversationId!, (body as { userId: string }).userId, "admin");
  }),
  createMockRoute("DELETE", "/api/v1/conversations/:conversationId/admins/:userId", ({ params }) => {
    requireGroupAdmin(params.conversationId!);
    setMemberRole(params.conversationId!, params.userId!, "member");
  }),
  createMockRoute("POST", "/api/v1/conversations/:conversationId/leave", ({ params }) => {
    const index = mockConversations.findIndex((c) => c.id === params.conversationId);
    if (index >= 0) mockConversations.splice(index, 1);
  }),
  createMockRoute("PATCH", "/api/v1/conversations/:conversationId", ({ params, body }) => {
    const update = body as ConversationSettingsUpdate;
    const me = getSignedInMockUser();
    const conversationNoun = mockConversations.find((c) => c.id === params.conversationId)?.kind === "channel" ? "channel" : "group";
    if (update.name !== undefined) postSystemNotice(params.conversationId!, `${me.name} renamed the ${conversationNoun} to "${update.name}"`);
    if (update.disappearingMessagesSeconds !== undefined) {
      postSystemNotice(params.conversationId!, `${me.name} ${describeDisappearingSetting(update.disappearingMessagesSeconds)}`);
    }
    return replaceMockConversation(params.conversationId!, (c) => ({
      ...c,
      ...(update.name !== undefined ? { title: update.name } : {}),
      ...(update.disappearingMessagesSeconds !== undefined ? { disappearingMessagesSeconds: update.disappearingMessagesSeconds } : {}),
    }));
  }),
  createMockRoute("POST", "/api/v1/channels", ({ body }) => {
    const input = body as NewChannelInput;
    const me = getSignedInMockUser();
    const channel: Conversation = {
      id: nextMockId("ch"),
      peer: mockChatUser(me.id),
      lastMessage: input.description ?? "Channel created",
      lastMessageAt: new Date().toISOString(),
      unread: 0,
      isFriend: false,
      kind: "channel",
      title: input.name.trim(),
      subscriberCount: 1,
      myRole: "owner",
    };
    mockConversations.unshift(channel);
    postSystemNotice(channel.id, `${me.name} created the channel`);
    return channel;
  }),
  createMockRoute("POST", "/api/v1/channels/:channelId/subscribe", ({ params }) =>
    replaceMockConversation(params.channelId!, (c) => ({ ...c, myRole: "subscriber", subscriberCount: (c.subscriberCount ?? 0) + 1 })),
  ),
  createMockRoute("DELETE", "/api/v1/channels/:channelId/subscribe", ({ params }) => {
    const index = mockConversations.findIndex((c) => c.id === params.channelId);
    if (index >= 0) mockConversations.splice(index, 1);
  }),
  createMockRoute("POST", "/api/v1/messages/:messageId/reactions", ({ params, body }) =>
    toggleMockReaction(params.messageId!, (body as { emoji: string }).emoji, true),
  ),
  createMockRoute("DELETE", "/api/v1/messages/:messageId/reactions/:emoji", ({ params }) => toggleMockReaction(params.messageId!, params.emoji!, false)),
];
