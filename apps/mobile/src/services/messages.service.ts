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

export const messagesService = {
  fetchConversationList: (filter: ConversationFilter) => api.get<Conversation[]>("/api/v1/conversations", { filter }),
  fetchInboxFolder: (folder: InboxFolder) => api.get<Conversation[]>("/api/v1/conversations", { folder }),
  acceptMessageRequest: (conversationId: string) => api.post<Conversation>(`/api/v1/conversations/${conversationId}/accept`),
  deleteMessageRequest: (conversationId: string) => api.delete<void>(`/api/v1/conversations/${conversationId}`),
  blockConversationPeer: (conversationId: string) => api.post<void>(`/api/v1/conversations/${conversationId}/block`),
  markConversationNotSpam: (conversationId: string) => api.post<Conversation>(`/api/v1/conversations/${conversationId}/not-spam`),
  fetchConversationById: (conversationId: string) => api.get<Conversation>(`/api/v1/conversations/${conversationId}`),
  fetchMessagesInConversation: (conversationId: string, options: { readonly cursor?: string; readonly after?: string } = {}) =>
    api.get<Page<Message>>(`/api/v1/conversations/${conversationId}/messages`, { cursor: options.cursor, after: options.after }),
  startConversationWithUser: (userId: string) => api.post<Conversation>("/api/v1/conversations", { userId }),
  sendChatMessageOrQueueWhenOffline: async (draft: OutgoingMessageDraft): Promise<{ readonly message: Message; readonly delivered: boolean }> => {
    const deliveredMessage = await runNowOrQueueWhenOffline(
      { kind: "sendMessage", payload: { conversationId: draft.conversationId, text: draft.text, localMessageId: draft.localMessageId, linkPreview: draft.linkPreview ?? null, mentions: draft.mentions } },
      (idempotencyKey) =>
        api.post<Message>(`/api/v1/conversations/${draft.conversationId}/messages`, { text: draft.text, linkPreview: draft.linkPreview ?? null, mentions: draft.mentions }, { idempotencyKey }),
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
  sendDocumentToConversation: (conversationId: string, document: MessageDocument, idempotencyKey: string) =>
    api.post<Message>(`/api/v1/conversations/${conversationId}/messages`, { kind: "document", document, text: "" }, { idempotencyKey }),
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
  searchConversationsAndPeople: (query: string) => api.get<ChatSearchResults>("/api/v1/conversations/search", { q: query }),
  fetchPeopleToMessage: (query: string) => api.getList<UserSummary>("/api/v1/search/people", { q: query }),
};
