import { runNowOrQueueWhenOffline } from "@/store/offline.store";
import type {
  ChatSearchResults,
  ConversationFilter,
  Conversation,
  ConversationSettingsUpdate,
  InboxFolder,
  LinkPreview,
  Message,
  MessageDocument,
  MessagePoll,
  MessageReactionSummary,
  SharedLocation,
  OutgoingVoiceNote,
  Page,
  UserSummary,
} from "@/types";

import type { MentionEntity } from "@/types/mention.type";

import { api } from "./apiClient.service";
import { chatCryptoService } from "./chatCrypto/chatCrypto.service";

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

export async function sendEncryptedTextMessage(
  conversationId: string,
  content: { readonly text: string; readonly linkPreview?: LinkPreview | null; readonly mentions?: readonly MentionEntity[] },
  idempotencyKey: string,
): Promise<Message> {
  const encrypted = await chatCryptoService.encryptForConversationId(conversationId, { text: content.text, linkPreview: content.linkPreview ?? null });
  const delivered = await api.post<Message>(`/api/v1/conversations/${conversationId}/messages`, { kind: "text", encryption: encrypted.encryption, linkPreview: encrypted.linkPreview, mentions: content.mentions }, { idempotencyKey });
  await encrypted.confirmSent(delivered.id);
  return { ...delivered, text: content.text, linkPreview: content.linkPreview ?? null, decryptionNotice: null };
}

export const messagesService = {
  fetchConversationList: (filter: ConversationFilter) => api.getList<Conversation>("/api/v1/conversations", { filter }),
  fetchInboxFolder: (folder: InboxFolder) => api.getList<Conversation>("/api/v1/conversations", { folder }),
  acceptMessageRequest: (conversationId: string) => api.post<Conversation>(`/api/v1/conversations/${conversationId}/accept`),
  deleteMessageRequest: (conversationId: string) => api.delete<void>(`/api/v1/conversations/${conversationId}`),
  blockConversationPeer: (conversationId: string) => api.post<void>(`/api/v1/conversations/${conversationId}/block`),
  markConversationNotSpam: (conversationId: string) => api.post<Conversation>(`/api/v1/conversations/${conversationId}/not-spam`),
  fetchConversationById: (conversationId: string) => api.get<Conversation>(`/api/v1/conversations/${conversationId}`),
  fetchMessagesInConversation: async (conversationId: string, options: { readonly cursor?: string; readonly after?: string } = {}): Promise<Page<Message>> => {
    const page = await api.get<Page<Message>>(`/api/v1/conversations/${conversationId}/messages`, { cursor: options.cursor, after: options.after });
    return { ...page, data: await chatCryptoService.decryptMessages(page.data) };
  },
  startConversationWithUser: (userId: string) => api.post<Conversation>("/api/v1/conversations", { userId }),
  sendChatMessageOrQueueWhenOffline: async (draft: OutgoingMessageDraft): Promise<{ readonly message: Message; readonly delivered: boolean }> => {
    const deliveredMessage = await runNowOrQueueWhenOffline(
      { kind: "sendMessage", payload: { conversationId: draft.conversationId, text: draft.text, localMessageId: draft.localMessageId, linkPreview: draft.linkPreview ?? null, mentions: draft.mentions } },
      (idempotencyKey) => sendEncryptedTextMessage(draft.conversationId, { text: draft.text, linkPreview: draft.linkPreview ?? null, mentions: draft.mentions }, idempotencyKey),
    );
    return deliveredMessage
      ? { message: deliveredMessage, delivered: true }
      : { message: buildLocalPendingMessageFromDraft(draft), delivered: false };
  },
  sendVoiceNoteToConversation: (conversationId: string, voiceNote: OutgoingVoiceNote, idempotencyKey: string) =>
    api.post<Message>(`/api/v1/conversations/${conversationId}/messages`, { ...voiceNote, text: "" }, { idempotencyKey }),
  sendImageToConversation: (conversationId: string, image: { readonly mediaId: string }, idempotencyKey: string) =>
    api.post<Message>(`/api/v1/conversations/${conversationId}/messages`, { kind: "image", mediaId: image.mediaId, text: "" }, { idempotencyKey }),
  sendLocationToConversation: (conversationId: string, kind: "location" | "liveLocation", location: SharedLocation, idempotencyKey: string) =>
    api.post<Message>(`/api/v1/conversations/${conversationId}/messages`, { kind, location, text: "" }, { idempotencyKey }),
  sendDocumentToConversation: (conversationId: string, document: MessageDocument, mediaId: string, idempotencyKey: string) =>
    api.post<Message>(
      `/api/v1/conversations/${conversationId}/messages`,
      { kind: "document", mediaId, document: { fileName: document.fileName, mimeType: document.mimeType, sizeBytes: document.sizeBytes, pageCount: document.pageCount ?? null } },
      { idempotencyKey },
    ),
  sendPollToConversation: (conversationId: string, poll: { readonly question: string; readonly allowMultipleAnswers: boolean; readonly options: readonly string[] }, idempotencyKey: string) =>
    api.post<Message>(`/api/v1/conversations/${conversationId}/messages`, { kind: "poll", poll, text: poll.question }, { idempotencyKey }),
  updateLiveLocation: (messageId: string, coordinates: { readonly latitude: number; readonly longitude: number; readonly address: string | null }) =>
    api.patch<Message>(`/api/v1/messages/${messageId}/location`, coordinates),
  stopLiveLocation: (messageId: string) => api.post<Message>(`/api/v1/messages/${messageId}/live-location/stop`),
  voteOnPoll: (messageId: string, optionId: string) => api.post<MessagePoll>(`/api/v1/messages/${messageId}/poll-votes`, { optionId }),
  updateConversationSettings: (conversationId: string, update: ConversationSettingsUpdate) =>
    api.patch<Conversation>(`/api/v1/conversations/${conversationId}`, update),
  addReactionToMessage: (messageId: string, emoji: string) =>
    api.post<MessageReactionSummary[]>(`/api/v1/messages/${messageId}/reactions`, { emoji }),
  removeReactionFromMessage: (messageId: string, emoji: string) =>
    api.delete<MessageReactionSummary[]>(`/api/v1/messages/${messageId}/reactions/${encodeURIComponent(emoji)}`),
  markConversationAsRead: (conversationId: string) => api.post<void>(`/api/v1/conversations/${conversationId}/read`),
  searchConversationsAndPeople: async (query: string): Promise<ChatSearchResults> =>
    query.trim() ? api.get<ChatSearchResults>("/api/v1/conversations/search", { q: query.trim() }) : { conversations: [], people: [] },
  fetchPeopleToMessage: async (query: string): Promise<UserSummary[]> => (query.trim() ? [...(await api.getList<UserSummary>("/api/v1/search/people", { q: query.trim() }))] : []),
};
