import type { GroupAttributes, GroupAvatar } from "@nantty/chat-crypto";

import type { ChatMuteDuration, ChatSettings, Conversation, ConversationMember, ConversationSettingsUpdate, ID, SharedContentCard, SharedContentReference } from "@/types";

import { chatCryptoService } from "./chatCrypto/chatCrypto.service";
import { buildEncryptedThumbnail, readImageSize, uploadEncryptedAttachment } from "./chatCrypto/encryptedAttachments.service";
import { createIdempotencyKey, sendListRequestToWebappServer, sendRequestToWebappServer } from "./clientApi.service";
import { messagesService } from "./messages.service";

export interface GroupInvitationLink {
  readonly id: string;
  readonly conversationId: string;
  /** Opaque bearer token returned only on creation; the API stores its hash. */
  readonly token: string;
  readonly expiresAt: string;
}

export interface GroupInvitationLinkRecord {
  readonly id: string;
  readonly conversationId: string;
  readonly createdAt: string;
  readonly expiresAt: string;
  readonly revokedAt: string | null;
}

export interface GroupInvitationLinkPage {
  readonly data: readonly GroupInvitationLinkRecord[];
  readonly nextCursor: string | null;
}

const announceGroupKey = (conversation: Conversation, viewerId: ID) => messagesService.sendControl(conversation, viewerId, { type: "groupUpdate" });

export const chatGroupsService = {
  fetchMembers: (conversationId: ID) => sendListRequestToWebappServer<ConversationMember>(`/api/v1/conversations/${conversationId}/members`),
  createInvitation: (conversationId: ID, inviteeId: ID) =>
    sendRequestToWebappServer<GroupInvitation>(`/api/v1/conversations/${encodeURIComponent(conversationId)}/invitations`, { method: "POST", body: { inviteeId }, idempotencyKey: createIdempotencyKey("group_invitation") }),
  createInvitationLink: (conversationId: ID, expiresInHours: 24 | 168 | 720 = 168) =>
    sendRequestToWebappServer<GroupInvitationLink>(`/api/v1/conversations/${encodeURIComponent(conversationId)}/invitation-links`, { method: "POST", body: { expiresInHours }, idempotencyKey: createIdempotencyKey("group_invitation_link") }),
  listInvitationLinks: (conversationId: ID, cursor?: string) =>
    sendRequestToWebappServer<GroupInvitationLinkPage>(`/api/v1/conversations/${encodeURIComponent(conversationId)}/invitation-links`, { query: { cursor, limit: 20 } }),
  revokeInvitationLink: (conversationId: ID, linkId: string) =>
    sendRequestToWebappServer<GroupInvitationLinkRecord>(`/api/v1/conversations/${encodeURIComponent(conversationId)}/invitation-links/${encodeURIComponent(linkId)}`, { method: "DELETE", idempotencyKey: createIdempotencyKey("group_invitation_link_revoke") }),
  uploadGroupPhoto: async (file: File): Promise<GroupAvatar> => {
    const size = await readImageSize(file);
    const uploaded = await uploadEncryptedAttachment(file, { contentType: file.type || "image/jpeg", fileName: null, ...size, thumbnail: await buildEncryptedThumbnail(file) }, "chat");
    return { mediaId: uploaded.mediaId, pointer: uploaded.pointer };
  },
  createGroup: async (viewerId: ID, attributes: GroupAttributes, memberIds: readonly ID[]): Promise<Conversation> => {
    const prepared = await chatCryptoService.prepareNewGroup(viewerId, attributes);
    const conversation = await sendRequestToWebappServer<Conversation>("/api/v1/conversations/groups", {
      method: "POST",
      body: { encryptedAttributes: prepared.encryptedAttributes, memberIds, ...(attributes.avatar ? { photoMediaId: attributes.avatar.mediaId } : {}) },
      idempotencyKey: createIdempotencyKey("group"),
    });
    await chatCryptoService.rememberGroupKey(conversation.id, prepared.groupKey);
    await announceGroupKey(conversation, viewerId).catch(() => undefined);
    return conversation;
  },
  updateAttributes: async (conversation: Conversation, viewerId: ID, attributes: GroupAttributes, options: { readonly rotate?: boolean } = {}): Promise<Conversation> => {
    const encryptedAttributes = await chatCryptoService.sealGroupAttributes(viewerId, conversation.id, attributes, options);
    const updated = await chatGroupsService.updateSettings(conversation.id, { encryptedAttributes });
    if (options.rotate) await announceGroupKey(updated, viewerId);
    return updated;
  },
  setPhoto: async (conversation: Conversation, viewerId: ID, attributes: GroupAttributes, avatar: GroupAvatar | null): Promise<Conversation> => {
    const encryptedAttributes = await chatCryptoService.sealGroupAttributes(viewerId, conversation.id, { ...attributes, avatar });
    return chatGroupsService.updateSettings(conversation.id, { encryptedAttributes, photoMediaId: avatar?.mediaId ?? null });
  },
  addMembers: async (conversation: Conversation, viewerId: ID, userIds: readonly ID[]) => {
    const members = await sendRequestToWebappServer<ConversationMember[]>(`/api/v1/conversations/${conversation.id}/members`, { method: "POST", body: { userIds } });
    await announceGroupKey(conversation, viewerId);
    return members;
  },
  removeMember: async (conversation: Conversation, viewerId: ID, userId: ID, attributes: GroupAttributes | null) => {
    await sendRequestToWebappServer<void>(`/api/v1/conversations/${conversation.id}/members/${userId}`, { method: "DELETE" });
    if (attributes) await chatGroupsService.updateAttributes(conversation, viewerId, attributes, { rotate: true });
    else await announceGroupKey(conversation, viewerId);
  },
  promoteToAdmin: (conversationId: ID, userId: ID) => sendRequestToWebappServer<void>(`/api/v1/conversations/${conversationId}/admins`, { method: "POST", body: { userId } }),
  demoteAdmin: (conversationId: ID, userId: ID) => sendRequestToWebappServer<void>(`/api/v1/conversations/${conversationId}/admins/${userId}`, { method: "DELETE" }),
  leave: (conversationId: ID) => sendRequestToWebappServer<void>(`/api/v1/conversations/${conversationId}/leave`, { method: "POST" }),
  updateSettings: (conversationId: ID, update: ConversationSettingsUpdate) => sendRequestToWebappServer<Conversation>(`/api/v1/conversations/${conversationId}`, { method: "PATCH", body: update }),
  setMute: (conversationId: ID, duration: ChatMuteDuration) => sendRequestToWebappServer<{ readonly mutedUntil: string | null }>(`/api/v1/conversations/${conversationId}/mute`, { method: "PUT", body: { duration } }),
};

export type GroupInvitationStatus = "pending" | "accepted" | "declined" | "revoked" | "expired";

export interface GroupInvitation {
  readonly id: string;
  readonly conversationId: string;
  readonly inviterId: string;
  readonly inviteeId: string;
  readonly status: GroupInvitationStatus;
  readonly createdAt: string;
  readonly expiresAt: string;
  readonly counterpart: { readonly id: string; readonly name: string; readonly username: string; readonly avatarUrl: string | null; readonly verified: boolean; readonly isCreator: boolean } | null;
  readonly membershipStatus: "not_joined" | "awaiting_secure_key_handoff";
}

export interface GroupInvitationPage {
  readonly data: readonly GroupInvitation[];
  readonly nextCursor: string | null;
}

export interface GroupInvitationLinkPreview {
  readonly group: { readonly title: string | null; readonly memberCount: number };
  readonly expiresAt: string;
}

export const groupInvitationsService = {
  previewLink: (token: string) => sendRequestToWebappServer<GroupInvitationLinkPreview>(`/api/v1/conversations/invitation-links/${encodeURIComponent(token)}/preview`),
  claimLink: (token: string) => sendRequestToWebappServer<GroupInvitation>(`/api/v1/conversations/invitation-links/${encodeURIComponent(token)}/claim`, { method: "POST", idempotencyKey: createIdempotencyKey("group_invitation_claim") }),
  listReceived: (cursor?: string) => sendRequestToWebappServer<GroupInvitationPage>("/api/v1/group-invitations", { query: { direction: "received", limit: 20, cursor } }),
  accept: (invitationId: string) => sendRequestToWebappServer<GroupInvitation>(`/api/v1/group-invitations/${encodeURIComponent(invitationId)}/accept`, { method: "POST", idempotencyKey: createIdempotencyKey("group_invitation_accept") }),
  decline: (invitationId: string) => sendRequestToWebappServer<GroupInvitation>(`/api/v1/group-invitations/${encodeURIComponent(invitationId)}/decline`, { method: "POST", idempotencyKey: createIdempotencyKey("group_invitation_decline") }),
};

export const chatSettingsService = {
  fetch: () => sendRequestToWebappServer<ChatSettings>("/api/v1/chat/settings"),
  update: (update: { readonly messageRequestsFrom?: ChatSettings["messageRequestsFrom"]; readonly preventDirectGroupAdds?: boolean; readonly notifications?: Partial<ChatSettings["notifications"]> }) =>
    sendRequestToWebappServer<ChatSettings>("/api/v1/chat/settings", { method: "PATCH", body: update }),
  resolveSharedContent: (reference: SharedContentReference) => sendRequestToWebappServer<SharedContentCard>("/api/v1/chat/content", { query: { kind: reference.kind, id: reference.id } }),
};
