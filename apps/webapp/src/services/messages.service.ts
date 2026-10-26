import { type AttachmentPointer, type ChatControl, type ChatLocation, type ChatPayloadInput, type ChatPoll, createPollOptions, defaultRandomSource } from "@nantty/chat-crypto";

import type { ChatSearchResults, Page } from "@/types";
import type { Conversation, ConversationFilter, InboxFolder, Message, UserSummary } from "@/types";

import { chatCryptoService } from "./chatCrypto/chatCrypto.service";
import { createIdempotencyKey, sendListRequestToWebappServer, sendRequestToWebappServer } from "./clientApi.service";

type EncryptedKind = "text" | "voice" | "image" | "video" | "document" | "location" | "liveLocation" | "poll" | "shared" | "control";

export interface SendEncryptedOptions {
  readonly kind: EncryptedKind;
  readonly idempotencyKey?: string;
  readonly payload: ChatPayloadInput;
  readonly mediaId?: string;
  readonly durationSeconds?: number;
}

export async function sendEncrypted(conversation: Conversation, viewerId: string, options: SendEncryptedOptions): Promise<Message> {
  const encrypted = await chatCryptoService.encryptForConversation(conversation, viewerId, options.payload);
  const message = await sendRequestToWebappServer<Message>(`/api/v1/conversations/${conversation.id}/messages`, {
    method: "POST",
    body: {
      kind: options.kind,
      encryption: encrypted.encryption,
      ...(encrypted.linkPreview ? { linkPreview: encrypted.linkPreview } : {}),
      ...(options.mediaId === undefined ? {} : { mediaId: options.mediaId }),
      ...(options.durationSeconds === undefined ? {} : { durationSeconds: Math.round(options.durationSeconds) }),
    },
    idempotencyKey: options.idempotencyKey ?? createIdempotencyKey("msg"),
  });
  await encrypted.confirmSent(message.id, message.expiresAt ?? null);
  return { ...message, clientMessageId: message.clientMessageId ?? options.idempotencyKey ?? null, text: options.payload.text, attachment: options.payload.attachment ?? null, location: options.payload.location ?? null, poll: options.payload.poll ?? null, control: options.payload.control ?? null };
}

export function buildPollDefinition(draft: { readonly question: string; readonly allowMultipleAnswers: boolean; readonly options: readonly string[] }): ChatPoll {
  return { question: draft.question.trim(), allowMultipleAnswers: draft.allowMultipleAnswers, options: createPollOptions(draft.options.map((option) => option.trim()).filter(Boolean), defaultRandomSource) };
}

export type OutgoingAttachmentKind = "image" | "video" | "voice" | "document";

export const messagesService = {
  fetchConversationList: (filter: ConversationFilter) => sendListRequestToWebappServer<Conversation>("/api/v1/conversations", { query: { filter } }),
  fetchInboxFolder: (folder: Exclude<InboxFolder, "chats">) => sendListRequestToWebappServer<Conversation>("/api/v1/conversations", { query: { folder } }),
  acceptMessageRequest: (conversationId: string) => sendRequestToWebappServer<Conversation>(`/api/v1/conversations/${conversationId}/accept`, { method: "POST" }),
  markConversationNotSpam: (conversationId: string) => sendRequestToWebappServer<Conversation>(`/api/v1/conversations/${conversationId}/not-spam`, { method: "POST" }),
  deleteMessageRequest: (conversationId: string) => sendRequestToWebappServer<void>(`/api/v1/conversations/${conversationId}`, { method: "DELETE" }),
  blockConversationPeer: (conversationId: string) => sendRequestToWebappServer<void>(`/api/v1/conversations/${conversationId}/block`, { method: "POST" }),
  fetchConversationById: (conversationId: string) => sendRequestToWebappServer<Conversation>(`/api/v1/conversations/${conversationId}`),
  fetchMessagesInConversation: (conversationId: string, options: { readonly cursor?: string; readonly after?: string } = {}) =>
    sendRequestToWebappServer<Page<Message>>(`/api/v1/conversations/${conversationId}/messages`, {
      query: { cursor: options.cursor, after: options.after },
    }),
  openStoreConversation: (storeId: string) => sendRequestToWebappServer<Conversation>(`/api/v1/conversations/stores/${encodeURIComponent(storeId)}`, { method: "POST" }),
  startConversationWithUser: (userId: string) => sendRequestToWebappServer<Conversation>("/api/v1/conversations", { method: "POST", body: { userId } }),
  sendChatMessage: (conversation: Conversation, viewerId: string, text: string, idempotencyKey?: string): Promise<Message> => sendEncrypted(conversation, viewerId, { kind: "text", payload: { text }, ...(idempotencyKey ? { idempotencyKey } : {}) }),
  sendAttachment: (conversation: Conversation, viewerId: string, attachment: { readonly kind: OutgoingAttachmentKind; readonly mediaId: string; readonly pointer: AttachmentPointer; readonly caption?: string }, idempotencyKey?: string) =>
    sendEncrypted(conversation, viewerId, {
      ...(idempotencyKey ? { idempotencyKey } : {}),
      kind: attachment.kind, mediaId: attachment.mediaId, payload: { text: attachment.caption ?? "", attachment: attachment.pointer },
      ...(attachment.pointer.durationSeconds ? { durationSeconds: attachment.pointer.durationSeconds } : {}),
    }),
  sendLocation: (conversation: Conversation, viewerId: string, location: ChatLocation, idempotencyKey?: string) =>
    sendEncrypted(conversation, viewerId, { ...(idempotencyKey ? { idempotencyKey } : {}), kind: location.liveUntil ? "liveLocation" : "location", payload: { text: "", location } }),
  sendPoll: (conversation: Conversation, viewerId: string, poll: ChatPoll, idempotencyKey?: string) =>
    sendEncrypted(conversation, viewerId, {
      ...(idempotencyKey ? { idempotencyKey } : {}),
      kind: "poll",
      payload: { text: "", poll },
    }),
  sendControl: (conversation: Conversation, viewerId: string, control: ChatControl, idempotencyKey?: string) => sendEncrypted(conversation, viewerId, { ...(idempotencyKey ? { idempotencyKey } : {}), kind: "control", payload: { text: "", control } }),
  fetchDecryptedMessagesInConversation: async (conversationId: string, viewerId: string, options: { readonly cursor?: string; readonly after?: string } = {}): Promise<Page<Message>> => {
    const page = await messagesService.fetchMessagesInConversation(conversationId, options);
    return { ...page, data: await chatCryptoService.decryptMessages(page.data, viewerId) };
  },
  markConversationAsRead: (conversationId: string) => sendRequestToWebappServer<void>(`/api/v1/conversations/${conversationId}/read`, { method: "POST" }),
  searchConversationsAndPeople: (query: string) => sendRequestToWebappServer<ChatSearchResults>("/api/v1/conversations/search", { query: { q: query } }),
  fetchPeopleToMessage: (query: string) => sendListRequestToWebappServer<UserSummary>("/api/v1/search/people", { query: { q: query } }),
};
