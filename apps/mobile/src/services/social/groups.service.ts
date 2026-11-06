import type { GroupAvatar } from "@nantty/chat-crypto";

import type { Conversation, ConversationMember, NewGroupConversationInput } from "@/types";

import { sendChatControl } from "../chat/messages.service";
import { withDecryptedGroupDetails } from "../chat/groupDetails.service";
import { chatCryptoService } from "../chatCrypto/chatCrypto.service";
import { uploadEncryptedAttachment } from "../chatCrypto/encryptedAttachments.service";
import { api, generateIdempotencyKey } from "../core/apiClient.service";
import { type LocalMediaFile, resizeAndReencodeImageWithoutMetadata } from "../media/mediaPreparation.service";

export type GroupInvitationDirection = "received" | "sent";
export type GroupInvitationStatus = "pending" | "accepted" | "declined" | "revoked" | "expired";

export interface GroupInvitation {
  readonly id: string;
  readonly conversationId: string;
  readonly inviterId: string;
  readonly inviteeId: string;
  readonly status: GroupInvitationStatus;
  readonly createdAt: string;
  readonly expiresAt: string;
  readonly counterpart: Pick<ConversationMember["user"], "id" | "name" | "username" | "avatarUrl" | "verified"> | null;
  readonly membershipStatus: "not_joined" | "awaiting_secure_key_handoff";
}

export interface GroupInvitationPage {
  readonly data: readonly GroupInvitation[];
  readonly nextCursor: string | null;
}

export interface GroupInvitationLink {
  readonly id: string;
  readonly conversationId: string;
  /** Opaque bearer token; the backend stores only its hash. */
  readonly token: string;
  readonly expiresAt: string;
}

export interface GroupInvitationLinkPreview {
  readonly group: { readonly title: string | null; readonly memberCount: number };
  readonly expiresAt: string;
}

export interface RevokedGroupInvitationLink {
  readonly id: string;
  readonly conversationId: string;
  readonly revokedAt: string;
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

const invitationPath = (invitationId: string) => `/api/v1/group-invitations/${encodeURIComponent(invitationId)}`;
const mutationOptions = () => ({ idempotencyKey: generateIdempotencyKey() });

const announceGroupKey = (conversationId: string) => sendChatControl(conversationId, { type: "groupUpdate" }).then(() => undefined);

export async function encryptAndUploadGroupPhoto(photo: LocalMediaFile): Promise<GroupAvatar> {
  const prepared = await resizeAndReencodeImageWithoutMetadata(photo);
  const { mediaId, pointer } = await uploadEncryptedAttachment(prepared.uri, { contentType: "image/jpeg", width: prepared.width, height: prepared.height }, "chat");
  return { mediaId, pointer };
}

async function resealGroupDetails(conversationId: string, rotate: boolean): Promise<void> {
  const current = await withDecryptedGroupDetails(await api.get<Conversation>(`/api/v1/conversations/${conversationId}`));
  if (!current.hasGroupKey || !current.title) return;
  const encryptedAttributes = await chatCryptoService.sealGroupAttributes(conversationId, { title: current.title, description: current.description ?? null, avatar: current.groupAvatar ?? null }, { rotate });
  await api.patch<Conversation>(`/api/v1/conversations/${conversationId}`, { encryptedAttributes });
}

export const groupsService = {
  createGroupConversation: async (input: NewGroupConversationInput & { readonly photo?: LocalMediaFile | null }): Promise<Conversation> => {
    const avatar = input.photo ? await encryptAndUploadGroupPhoto(input.photo) : null;
    const prepared = await chatCryptoService.prepareNewGroup({ title: input.name.trim(), description: input.description?.trim() || null, avatar });
    const created = await api.post<Conversation>("/api/v1/conversations/groups", { encryptedAttributes: prepared.encryptedAttributes, memberIds: input.memberIds, ...(avatar ? { photoMediaId: avatar.mediaId } : {}) });
    await chatCryptoService.rememberGroupKey(created.id, prepared.groupKey);
    await announceGroupKey(created.id).catch(() => undefined);
    return withDecryptedGroupDetails(created);
  },
  renameGroup: async (conversation: Conversation, name: string): Promise<Conversation> => {
    const encryptedAttributes = await chatCryptoService.sealGroupAttributes(conversation.id, { title: name.trim(), description: conversation.description ?? null, avatar: conversation.groupAvatar ?? null });
    const updated = await withDecryptedGroupDetails(await api.patch<Conversation>(`/api/v1/conversations/${conversation.id}`, { encryptedAttributes }));
    await announceGroupKey(conversation.id).catch(() => undefined);
    return updated;
  },
  changeGroupPhoto: async (conversation: Conversation, photo: LocalMediaFile | null): Promise<Conversation> => {
    const avatar = photo ? await encryptAndUploadGroupPhoto(photo) : null;
    const encryptedAttributes = await chatCryptoService.sealGroupAttributes(conversation.id, { title: conversation.title ?? "Group", description: conversation.description ?? null, avatar });
    const updated = await withDecryptedGroupDetails(await api.patch<Conversation>(`/api/v1/conversations/${conversation.id}`, { encryptedAttributes, photoMediaId: avatar?.mediaId ?? null }));
    await announceGroupKey(conversation.id).catch(() => undefined);
    return updated;
  },
  fetchConversationMembers: (conversationId: string) => api.getList<ConversationMember>(`/api/v1/conversations/${conversationId}/members`),
  createGroupInvitation: (conversationId: string, inviteeId: string) =>
    api.post<GroupInvitation>(`/api/v1/conversations/${encodeURIComponent(conversationId)}/invitations`, { inviteeId }, mutationOptions()),
  listGroupInvitations: (direction: GroupInvitationDirection, cursor?: string) =>
    api.getPage<GroupInvitation>("/api/v1/group-invitations", { direction, cursor, limit: 20 }),
  acceptGroupInvitation: (invitationId: string) =>
    api.post<GroupInvitation>(`${invitationPath(invitationId)}/accept`, undefined, mutationOptions()),
  declineGroupInvitation: (invitationId: string) =>
    api.post<GroupInvitation>(`${invitationPath(invitationId)}/decline`, undefined, mutationOptions()),
  revokeGroupInvitation: (conversationId: string, invitationId: string) =>
    api.delete<GroupInvitation>(`/api/v1/conversations/${encodeURIComponent(conversationId)}/invitations/${encodeURIComponent(invitationId)}`, mutationOptions()),
  createGroupInvitationLink: (conversationId: string, expiresInHours: 24 | 168 | 720 = 168) =>
    api.post<GroupInvitationLink>(`/api/v1/conversations/${encodeURIComponent(conversationId)}/invitation-links`, { expiresInHours }, mutationOptions()),
  listGroupInvitationLinks: (conversationId: string, cursor?: string) =>
    api.getPage<GroupInvitationLinkRecord>(`/api/v1/conversations/${encodeURIComponent(conversationId)}/invitation-links`, { cursor, limit: 20 }),
  previewGroupInvitationLink: (token: string) =>
    api.get<GroupInvitationLinkPreview>(`/api/v1/conversations/invitation-links/${encodeURIComponent(token)}/preview`),
  claimGroupInvitationLink: (token: string) =>
    api.post<GroupInvitation>(`/api/v1/conversations/invitation-links/${encodeURIComponent(token)}/claim`, undefined, mutationOptions()),
  revokeGroupInvitationLink: (conversationId: string, linkId: string) =>
    api.delete<RevokedGroupInvitationLink>(`/api/v1/conversations/${encodeURIComponent(conversationId)}/invitation-links/${encodeURIComponent(linkId)}`, mutationOptions()),
  addMembersToGroup: async (conversationId: string, userIds: readonly string[]) => {
    const members = await api.post<ConversationMember[]>(`/api/v1/conversations/${conversationId}/members`, { userIds });
    await announceGroupKey(conversationId).catch(() => undefined);
    return members;
  },
  removeMemberFromGroup: async (conversationId: string, userId: string) => {
    await api.delete<void>(`/api/v1/conversations/${conversationId}/members/${userId}`);
    await resealGroupDetails(conversationId, true).catch(() => undefined);
    await announceGroupKey(conversationId).catch(() => undefined);
  },
  promoteMemberToAdmin: (conversationId: string, userId: string) =>
    api.post<void>(`/api/v1/conversations/${conversationId}/admins`, { userId }),
  demoteAdminToMember: (conversationId: string, userId: string) =>
    api.delete<void>(`/api/v1/conversations/${conversationId}/admins/${userId}`),
  leaveConversation: (conversationId: string) => api.post<void>(`/api/v1/conversations/${conversationId}/leave`),
};
