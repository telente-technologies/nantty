import type { Conversation, Message } from "@/types";

import { buildMessageSyncCursor, type LocalMessageDeliveryStatus, type LocallyStoredMessage, type MessageHistoryStore } from "./messageHistory.type";

const conversationsKeptInMemory = new Map<string, Conversation>();
const messagesKeptInMemory = new Map<string, LocallyStoredMessage>();

const compareMessagesOldestFirst = (first: Message, second: Message) =>
  first.createdAt === second.createdAt ? first.id.localeCompare(second.id) : first.createdAt.localeCompare(second.createdAt);

const keepMessageInMemory = (message: Message, deliveryStatus: LocalMessageDeliveryStatus) =>
  messagesKeptInMemory.set(message.id, { ...message, deliveryStatus });

const hasMessageExpired = (message: Message) => !!message.expiresAt && message.expiresAt <= new Date().toISOString();

const readMessagesInConversationOldestFirst = (conversationId: string) =>
  [...messagesKeptInMemory.values()]
    .filter((message) => message.conversationId === conversationId && !hasMessageExpired(message))
    .sort(compareMessagesOldestFirst);

export const messageHistoryStore: MessageHistoryStore = {
  isPersistentStorageAvailable: false,
  readSavedConversations: (filter) =>
    [...conversationsKeptInMemory.values()]
      .filter((conversation) => filter !== "direct" || conversation.isFriend)
      .sort((first, second) => second.lastMessageAt.localeCompare(first.lastMessageAt)),
  saveConversations: (conversations) => conversations.forEach((conversation) => conversationsKeptInMemory.set(conversation.id, conversation)),
  readSavedMessagesInConversation: readMessagesInConversationOldestFirst,
  readLatestSyncCursorForConversation: (conversationId) => {
    const deliveredMessages = readMessagesInConversationOldestFirst(conversationId).filter((message) => message.deliveryStatus === "sent");
    const latestDeliveredMessage = deliveredMessages[deliveredMessages.length - 1];
    return latestDeliveredMessage ? buildMessageSyncCursor(latestDeliveredMessage) : null;
  },
  saveDeliveredMessages: (messages) => messages.forEach((message) => keepMessageInMemory(message, "sent")),
  savePendingOutgoingMessage: (message) => keepMessageInMemory(message, "pending"),
  replacePendingMessageWithDeliveredMessage: (localMessageId, deliveredMessage) => {
    messagesKeptInMemory.delete(localMessageId);
    keepMessageInMemory(deliveredMessage, "sent");
  },
  markPendingMessageAsFailed: (localMessageId) => {
    const pendingMessage = messagesKeptInMemory.get(localMessageId);
    if (pendingMessage) messagesKeptInMemory.set(localMessageId, { ...pendingMessage, deliveryStatus: "failed" });
  },
  deleteLocalMessage: (localMessageId) => {
    messagesKeptInMemory.delete(localMessageId);
  },
  deleteExpiredMessages: () => {
    for (const [messageId, message] of messagesKeptInMemory) if (hasMessageExpired(message)) messagesKeptInMemory.delete(messageId);
  },
  deleteAllSavedMessageHistory: () => {
    conversationsKeptInMemory.clear();
    messagesKeptInMemory.clear();
  },
};
