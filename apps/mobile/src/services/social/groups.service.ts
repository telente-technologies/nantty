import type { GroupAvatar } from "@zudomart/chat-crypto";

import type { Conversation, ConversationMember, NewGroupConversationInput } from "@/types";

import { sendChatControl } from "../chat/messages.service";
import { withDecryptedGroupDetails } from "../chat/groupDetails.service";
import { chatCryptoService } from "../chatCrypto/chatCrypto.service";
import { uploadEncryptedAttachment } from "../chatCrypto/encryptedAttachments.service";
import { api } from "../core/apiClient.service";
import { type LocalMediaFile, resizeAndReencodeImageWithoutMetadata } from "../media/mediaPreparation.service";

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
