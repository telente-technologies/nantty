import { runNowOrQueueWhenOffline } from "@/store/offline.store";
import type {
  ChatSearchResults,
  ConversationFilter,
  Conversation,
  ConversationSettingsUpdate,
  InboxFolder,
  LinkPreview,
  Message,
  SharedLocation,
  OutgoingVoiceNote,
  Page,
  UserSummary,
} from "@/types";

import type { MentionEntity } from "@/types/mention.type";

import { type AttachmentPointer, type ChatControl, type ChatLocation, type ChatPayloadInput, createPollOptions, maximumLiveLocationMilliseconds } from "@zudomart/chat-crypto";

import { api, generateIdempotencyKey } from "../core/apiClient.service";
import { chatCryptoService, messageFieldsFromPayload } from "../chatCrypto/chatCrypto.service";
import { randomBytesFromDevice } from "../chatCrypto/mobileKeyStore";
import { matchesGroupTitle, withDecryptedGroupDetails, withDecryptedGroupDetailsForAll } from "./groupDetails.service";
import { messageHistoryStore } from "@/cache/messageHistory.database";

export interface OutgoingMessageDraft {
  readonly conversationId: string;
  readonly senderId: string;
  readonly text: string;
  readonly localMessageId: string;
  readonly linkPreview?: LinkPreview | null;
  readonly mentions?: readonly MentionEntity[];
}

export const buildLocalPendingMessageFromDraft = (draft: OutgoingMessageDraft): Message => ({
  id: draft.localMessageId,
  conversationId: draft.conversationId,
  senderId: draft.senderId,
  text: draft.text,
  linkPreview: draft.linkPreview ?? null,
  ...(draft.mentions?.length ? { mentions: draft.mentions } : {}),
  createdAt: new Date().toISOString(),
});

type EncryptedMessageKind = "text" | "voice" | "image" | "document" | "location" | "liveLocation" | "poll" | "control";

interface EncryptedMessageExtras {
  readonly mediaId?: string;
  readonly durationSeconds?: number;
  readonly mentions?: readonly MentionEntity[];
}

async function sendEncryptedMessage(conversationId: string, kind: EncryptedMessageKind, input: ChatPayloadInput, extras: EncryptedMessageExtras, idempotencyKey: string): Promise<Message> {
  const encrypted = await chatCryptoService.encryptForConversationId(conversationId, input);
  const body = {
    kind, encryption: encrypted.encryption,
    ...(encrypted.linkPreview ? { linkPreview: encrypted.linkPreview } : {}),
    ...(extras.mediaId === undefined ? {} : { mediaId: extras.mediaId }),
    ...(extras.durationSeconds === undefined ? {} : { durationSeconds: extras.durationSeconds }),
    ...(extras.mentions?.length ? { mentions: extras.mentions } : {}),
  };
  const delivered = await api.post<Message>(`/api/v1/conversations/${conversationId}/messages`, body, { idempotencyKey });
  await encrypted.confirmSent(delivered.id, delivered.expiresAt ?? null);
  const decryptedFields = messageFieldsFromPayload({ ...delivered, kind }, { v: 1, sentAt: delivered.createdAt, ...input, linkPreview: input.linkPreview ?? null });
  return { ...delivered, ...decryptedFields, decryptionNotice: null };
}

export async function sendEncryptedTextMessage(
  conversationId: string,
  content: { readonly text: string; readonly linkPreview?: LinkPreview | null; readonly mentions?: readonly MentionEntity[] },
  idempotencyKey: string,
): Promise<Message> {
  return sendEncryptedMessage(conversationId, "text", { text: content.text, linkPreview: content.linkPreview ?? null }, { mentions: content.mentions }, idempotencyKey);
}

async function sendEncryptedMediaMessage(
  conversationId: string,
  media: { readonly kind: "image" | "voice" | "document"; readonly mediaId: string; readonly attachment: AttachmentPointer; readonly durationSeconds?: number },
  idempotencyKey: string,
): Promise<Message> {
  return sendEncryptedMessage(conversationId, media.kind, { text: "", attachment: media.attachment }, { mediaId: media.mediaId, durationSeconds: media.durationSeconds }, idempotencyKey);
}

export const sendChatControl = (conversationId: string, control: ChatControl, idempotencyKey: string = generateIdempotencyKey()) =>
  sendEncryptedMessage(conversationId, "control", { text: "", control }, {}, idempotencyKey);

export const toPayloadLocation = (location: SharedLocation): ChatLocation => ({
  latitude: location.latitude, longitude: location.longitude, label: location.address ?? null, ...(location.liveUntil ? { liveUntil: location.liveUntil } : {}),
});

export function clampLiveUntil(requested: string, now: Date = new Date()): string {
  const latest = now.getTime() + maximumLiveLocationMilliseconds - 120_000;
  return new Date(Math.min(Date.parse(requested), latest)).toISOString();
}

export const withAttachmentDetails = <T extends Message>(message: T): T => {
  const attachment = message.attachment;
  if (!attachment || message.kind !== "document") return message;
  return { ...message, document: { fileName: attachment.fileName ?? "Document", mimeType: attachment.contentType, sizeBytes: attachment.sizeBytes, pageCount: attachment.pageCount ?? null, url: message.document?.url ?? null } };
};

export const messagesService = {
  fetchConversationList: async (filter: ConversationFilter) => withDecryptedGroupDetailsForAll(await api.getList<Conversation>("/api/v1/conversations", { filter })),
  fetchInboxFolder: async (folder: InboxFolder) => withDecryptedGroupDetailsForAll(await api.getList<Conversation>("/api/v1/conversations", { folder })),
  acceptMessageRequest: (conversationId: string) => api.post<Conversation>(`/api/v1/conversations/${conversationId}/accept`),
  deleteMessageRequest: (conversationId: string) => api.delete<void>(`/api/v1/conversations/${conversationId}`),
  blockConversationPeer: (conversationId: string) => api.post<void>(`/api/v1/conversations/${conversationId}/block`),
  markConversationNotSpam: (conversationId: string) => api.post<Conversation>(`/api/v1/conversations/${conversationId}/not-spam`),
  fetchConversationById: async (conversationId: string) => withDecryptedGroupDetails(await api.get<Conversation>(`/api/v1/conversations/${conversationId}`)),
  fetchMessagesInConversation: async (conversationId: string, options: { readonly cursor?: string; readonly after?: string } = {}): Promise<Page<Message>> => {
    const page = await api.get<Page<Message>>(`/api/v1/conversations/${conversationId}/messages`, { cursor: options.cursor, after: options.after });
    return { ...page, data: await chatCryptoService.decryptMessages(page.data) };
  },
  startConversationWithUser: (userId: string) => api.post<Conversation>("/api/v1/conversations", { userId }),
  openStoreConversation: (storeId: string) => api.post<Conversation>(`/api/v1/conversations/stores/${encodeURIComponent(storeId)}`),
  sendChatMessageOrQueueWhenOffline: async (draft: OutgoingMessageDraft): Promise<{ readonly message: Message; readonly delivered: boolean }> => {
    const deliveredMessage = await runNowOrQueueWhenOffline(
      { kind: "sendMessage", payload: { conversationId: draft.conversationId, text: draft.text, localMessageId: draft.localMessageId, linkPreview: draft.linkPreview ?? null, mentions: draft.mentions } },
      (idempotencyKey) => sendEncryptedTextMessage(draft.conversationId, { text: draft.text, linkPreview: draft.linkPreview ?? null, mentions: draft.mentions }, idempotencyKey),
    );
    return deliveredMessage
      ? { message: deliveredMessage, delivered: true }
      : { message: buildLocalPendingMessageFromDraft(draft), delivered: false };
  },
  sendVoiceNoteToConversation: (conversationId: string, voiceNote: OutgoingVoiceNote & { readonly attachment: AttachmentPointer }, idempotencyKey: string) =>
    sendEncryptedMediaMessage(conversationId, { kind: "voice", mediaId: voiceNote.mediaId, durationSeconds: voiceNote.durationSeconds, attachment: voiceNote.attachment }, idempotencyKey),
  sendImageToConversation: (conversationId: string, image: { readonly mediaId: string; readonly attachment: AttachmentPointer }, idempotencyKey: string) =>
    sendEncryptedMediaMessage(conversationId, { kind: "image", mediaId: image.mediaId, attachment: image.attachment }, idempotencyKey),
  sendLocationToConversation: (conversationId: string, kind: "location" | "liveLocation", location: SharedLocation, idempotencyKey: string) => {
    const payloadLocation = toPayloadLocation(kind === "liveLocation" && location.liveUntil ? { ...location, liveUntil: clampLiveUntil(location.liveUntil) } : { ...location, liveUntil: null });
    return sendEncryptedMessage(conversationId, kind, { text: "", location: payloadLocation }, {}, idempotencyKey);
  },
  sendDocumentToConversation: (conversationId: string, mediaId: string, attachment: AttachmentPointer, idempotencyKey: string) =>
    sendEncryptedMediaMessage(conversationId, { kind: "document", mediaId, attachment }, idempotencyKey),
  sendPollToConversation: (conversationId: string, poll: { readonly question: string; readonly allowMultipleAnswers: boolean; readonly options: readonly string[] }, idempotencyKey: string) =>
    sendEncryptedMessage(conversationId, "poll", { text: "", poll: { question: poll.question.trim(), allowMultipleAnswers: poll.allowMultipleAnswers, options: createPollOptions(poll.options, randomBytesFromDevice) } }, {}, idempotencyKey),
  updateLiveLocation: (conversationId: string, messageId: string, coordinates: { readonly latitude: number; readonly longitude: number; readonly address: string | null }) =>
    sendChatControl(conversationId, { type: "locationUpdate", targetMessageId: messageId, latitude: coordinates.latitude, longitude: coordinates.longitude, label: coordinates.address }),
  stopLiveLocation: (conversationId: string, messageId: string) => sendChatControl(conversationId, { type: "locationStop", targetMessageId: messageId }),
  voteOnPoll: (conversationId: string, messageId: string, optionIds: readonly string[]) => sendChatControl(conversationId, { type: "pollVote", targetMessageId: messageId, optionIds }),
  setReactionOnMessage: (conversationId: string, messageId: string, emoji: string, shouldReact: boolean) =>
    sendChatControl(conversationId, { type: "reaction", targetMessageId: messageId, emoji, remove: !shouldReact }),
  updateConversationSettings: async (conversationId: string, update: ConversationSettingsUpdate) =>
    withDecryptedGroupDetails(await api.patch<Conversation>(`/api/v1/conversations/${conversationId}`, update)),
  markConversationAsRead: (conversationId: string) => api.post<void>(`/api/v1/conversations/${conversationId}/read`),
  searchConversationsAndPeople: async (query: string): Promise<ChatSearchResults> => {
    if (!query.trim()) return { conversations: [], people: [] };
    const remote = await api.get<ChatSearchResults>("/api/v1/conversations/search", { q: query.trim() });
    const groups = messageHistoryStore.readSavedConversations("all").filter((conversation) => matchesGroupTitle(conversation, query) && !remote.conversations.some((result) => result.id === conversation.id));
    return { ...remote, conversations: [...groups.map((group) => ({ id: group.id, peer: { ...group.peer, name: group.title ?? "Group" }, snippet: "" })), ...remote.conversations] };
  },
  fetchPeopleToMessage: async (query: string): Promise<UserSummary[]> => (query.trim() ? [...(await api.getList<UserSummary>("/api/v1/search/people", { q: query.trim() }))] : []),
};
