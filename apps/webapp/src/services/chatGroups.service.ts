import type { GroupAttributes, GroupAvatar } from "@nantty/chat-crypto";

import type { ChatMuteDuration, ChatSettings, Conversation, ConversationMember, ConversationSettingsUpdate, ID, SharedContentCard, SharedContentReference } from "@/types";

import { chatCryptoService } from "./chatCrypto/chatCrypto.service";
import { buildEncryptedThumbnail, readImageSize, uploadEncryptedAttachment } from "./chatCrypto/encryptedAttachments.service";
import { createIdempotencyKey, sendListRequestToWebappServer, sendRequestToWebappServer } from "./clientApi.service";
import { messagesService } from "./messages.service";

const announceGroupKey = (conversation: Conversation, viewerId: ID) => messagesService.sendControl(conversation, viewerId, { type: "groupUpdate" });

export const chatGroupsService = {
  fetchMembers: (conversationId: ID) => sendListRequestToWebappServer<ConversationMember>(`/api/v1/conversations/${conversationId}/members`),
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

export const chatSettingsService = {
  fetch: () => sendRequestToWebappServer<ChatSettings>("/api/v1/chat/settings"),
  update: (update: { readonly messageRequestsFrom?: ChatSettings["messageRequestsFrom"]; readonly notifications?: Partial<ChatSettings["notifications"]> }) =>
    sendRequestToWebappServer<ChatSettings>("/api/v1/chat/settings", { method: "PATCH", body: update }),
  resolveSharedContent: (reference: SharedContentReference) => sendRequestToWebappServer<SharedContentCard>("/api/v1/chat/content", { query: { kind: reference.kind, id: reference.id } }),
};
