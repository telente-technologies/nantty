import { ApiError } from "@/errors/api.error";
import type {
  Conversation,
  ConversationMember,
  ConversationSettingsUpdate,
  NewChannelInput,
} from "@/types";

import { appendMockMessageAndUpdateConversation, findMockConversation, mockChatUser, mockConversations } from "./chats.mock";
import { getSignedInMockUser } from "./fixtures.mock";
import { registerGroupMentionLookup } from "./mentionRules.mock";
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

registerGroupMentionLookup((conversationId, authorId) => {
  const members = membersByConversationId.get(conversationId);
  if (!members) return null;
  const authorRole = members.find((member) => member.user.id === authorId)?.role;
  return {
    memberUserIds: members.map((member) => member.user.id),
    authorIsAdmin: authorRole === "owner" || authorRole === "admin",
    onlyAdminsCanMentionAll: findMockConversation(conversationId).onlyAdminsCanMentionAll === true,
  };
});

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

const signedGroupPhotoUrl = (mediaId: string | null) => (mediaId ? `https://mock-media.zudomart.local/chat/${mediaId}?signature=member` : null);

export const mockStoreInboxTeam = ["u_store_owner", "u_store_agent"];

function openMockStoreConversation(storeId: string): Conversation {
  const id = `biz_${storeId}`;
  const existing = mockConversations.find((conversation) => conversation.id === id);
  if (existing) return existing;
  const storeName = "Ada Fabrics";
  const conversation: Conversation = {
    id, peer: { ...mockChatUser("u_20"), id: storeId, name: storeName, username: "" }, lastMessage: "", lastMessageAt: new Date().toISOString(), unread: 0, isFriend: false, kind: "business", title: null,
    store: { id: storeId, name: storeName, avatarUrl: null },
  };
  mockConversations.push(conversation);
  return conversation;
}

function mockEncryptionRecipients(conversationId: string) {
  const me = getSignedInMockUser().id;
  const conversation = findMockConversation(conversationId);
  if (conversation.kind === "business") return { userIds: [me, ...mockStoreInboxTeam], storeTeamUserIds: mockStoreInboxTeam };
  if (conversation.kind === "group" || conversation.kind === "channel") return { userIds: (membersByConversationId.get(conversationId) ?? []).map((member) => member.user.id), storeTeamUserIds: [] };
  return { userIds: [me, conversation.peer.id], storeTeamUserIds: [] };
}

export const groupsMocks: MockRoute[] = [
  createMockRoute("GET", "/api/v1/conversations/:conversationId/recipients", ({ params }) => mockEncryptionRecipients(params.conversationId!)),
  createMockRoute("POST", "/api/v1/conversations/stores/:storeId", ({ params }) => openMockStoreConversation(params.storeId!)),
  createMockRoute("POST", "/api/v1/conversations/stores/:storeId/messages", ({ body }) => {
    const input = (body ?? {}) as Record<string, unknown>;
    if (["body", "text", "location", "poll", "document", "sharedContent"].some((field) => input[field] !== undefined && input[field] !== null && input[field] !== "")) {
      throw new ApiError(422, "Chats are end-to-end encrypted. Update Zudomart to send this.", "PLAINTEXT_NOT_ACCEPTED");
    }
    throw new ApiError(422, "Open the store chat and send an encrypted message.", "ENCRYPTION_REQUIRED");
  }),
  createMockRoute("POST", "/api/v1/conversations/groups", ({ body }) => {
    const input = body as { readonly name?: unknown; readonly encryptedAttributes?: string; readonly memberIds: readonly string[]; readonly photoMediaId?: string };
    if (input.name !== undefined && input.name !== "") throw new ApiError(422, "Group names and photos are end-to-end encrypted. Update Zudomart to create or rename groups.", "PLAINTEXT_NOT_ACCEPTED");
    if (!input.encryptedAttributes || input.encryptedAttributes.length < 64) throw new ApiError(422, "A new group needs its encrypted details.", "ENCRYPTION_REQUIRED");
    const me = getSignedInMockUser();
    const conversation: Conversation = {
      id: nextMockId("g"),
      peer: mockChatUser(input.memberIds[0] ?? "u_20"),
      lastMessage: "",
      lastMessageAt: new Date().toISOString(),
      unread: 0,
      isFriend: true,
      kind: "group",
      title: null,
      encryptedAttributes: input.encryptedAttributes,
      photoMediaId: input.photoMediaId ?? null,
      photoUrl: signedGroupPhotoUrl(input.photoMediaId ?? null),
      memberCount: input.memberIds.length + 1,
      myRole: "owner",
      disappearingMessagesSeconds: null,
    };
    mockConversations.unshift(conversation);
    membersByConversationId.set(conversation.id, [
      { user: mockChatUser(me.id), role: "owner" },
      ...input.memberIds.map((userId) => ({ user: mockChatUser(userId), role: "member" as const })),
    ]);
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
    const update = body as ConversationSettingsUpdate & { readonly encryptedAttributes?: string; readonly photoMediaId?: string | null };
    const target = mockConversations.find((c) => c.id === params.conversationId);
    if (target?.kind === "group" && update.name !== undefined) throw new ApiError(422, "Group names and photos are end-to-end encrypted. Update Zudomart to create or rename groups.", "PLAINTEXT_NOT_ACCEPTED");
    if (update.encryptedAttributes !== undefined || (target?.kind === "group" && update.photoMediaId !== undefined)) requireGroupAdmin(params.conversationId!);
    const me = getSignedInMockUser();
    const conversationNoun = mockConversations.find((c) => c.id === params.conversationId)?.kind === "channel" ? "channel" : "group";
    if (update.onlyAdminsCanMentionAll !== undefined) requireGroupAdmin(params.conversationId!);
    if (update.name !== undefined) postSystemNotice(params.conversationId!, `${me.name} renamed the ${conversationNoun} to "${update.name}"`);
    if (update.disappearingMessagesSeconds !== undefined) {
      postSystemNotice(params.conversationId!, `${me.name} ${describeDisappearingSetting(update.disappearingMessagesSeconds)}`);
    }
    return replaceMockConversation(params.conversationId!, (c) => ({
      ...c,
      ...(update.name !== undefined ? { title: update.name } : {}),
      ...(update.encryptedAttributes !== undefined ? { encryptedAttributes: update.encryptedAttributes } : {}),
      ...(update.photoMediaId !== undefined ? { photoMediaId: update.photoMediaId, photoUrl: signedGroupPhotoUrl(update.photoMediaId) } : {}),
      ...(update.disappearingMessagesSeconds !== undefined ? { disappearingMessagesSeconds: update.disappearingMessagesSeconds } : {}),
      ...(update.onlyAdminsCanMentionAll !== undefined ? { onlyAdminsCanMentionAll: update.onlyAdminsCanMentionAll } : {}),
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
];
