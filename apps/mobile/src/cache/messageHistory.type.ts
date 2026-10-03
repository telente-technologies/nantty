import type { Conversation, ConversationFilter, Message } from "@/types";

export type LocalMessageDeliveryStatus = "sent" | "pending" | "failed";

export interface LocallyStoredMessage extends Message {
  readonly deliveryStatus: LocalMessageDeliveryStatus;
}

export interface MessageHistoryStore {
  readonly isPersistentStorageAvailable: boolean;
  readonly readSavedConversations: (filter: ConversationFilter) => Conversation[];
  readonly saveConversations: (conversations: readonly Conversation[]) => void;
  readonly readSavedMessagesInConversation: (conversationId: string) => LocallyStoredMessage[];
  readonly readLatestSyncCursorForConversation: (conversationId: string) => string | null;
  readonly saveDeliveredMessages: (messages: readonly Message[]) => void;
  readonly savePendingOutgoingMessage: (message: Message) => void;
  readonly replacePendingMessageWithDeliveredMessage: (localMessageId: string, deliveredMessage: Message) => void;
  readonly markPendingMessageAsFailed: (localMessageId: string) => void;
  readonly deleteLocalMessage: (localMessageId: string) => void;
  readonly deleteExpiredMessages: () => void;
  readonly deleteAllSavedMessageHistory: () => void;
}

export const buildMessageSyncCursor = (message: Pick<Message, "createdAt" | "id">) => `${message.createdAt}|${message.id}`;

export const isMessageAfterSyncCursor = (message: Pick<Message, "createdAt" | "id">, cursor: string) => {
  const [cursorCreatedAt = "", cursorMessageId = ""] = cursor.split("|");
  if (message.createdAt !== cursorCreatedAt) return message.createdAt > cursorCreatedAt;
  return message.id > cursorMessageId;
};
