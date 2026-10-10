import { isNetworkFailureError } from "@/services/core/apiClient.service";
import { messagesService } from "@/services/chat/messages.service";
import type { Conversation, ConversationFilter } from "@/types";

import { messageHistoryStore } from "./messageHistory.database";
import { readMessageIdFromSyncCursor, type LocallyStoredMessage } from "./messageHistory.type";

const MAXIMUM_SYNC_PAGES_PER_OPEN = 10;

export const readSavedMessagesForInstantDisplay = (conversationId: string): LocallyStoredMessage[] =>
  messageHistoryStore.readSavedMessagesInConversation(conversationId);

export const readSavedConversationsForInstantDisplay = (filter: ConversationFilter): Conversation[] =>
  messageHistoryStore.readSavedConversations(filter);

async function downloadMessagesNewerThanLocalHistory(conversationId: string) {
  const latestSyncCursor = messageHistoryStore.readLatestSyncCursorForConversation(conversationId);
  let pageCursor: string | undefined;
  for (let pageNumber = 0; pageNumber < MAXIMUM_SYNC_PAGES_PER_OPEN; pageNumber++) {
    const page = await messagesService.fetchMessagesInConversation(conversationId, {
      after: latestSyncCursor ? readMessageIdFromSyncCursor(latestSyncCursor) : undefined,
      cursor: pageCursor,
    });
    messageHistoryStore.saveDeliveredMessages(page.data);
    if (!page.nextCursor) return;
    pageCursor = page.nextCursor;
  }
}

export async function syncConversationMessagesIncrementallyAndReadLocalHistory(conversationId: string): Promise<LocallyStoredMessage[]> {
  try {
    await downloadMessagesNewerThanLocalHistory(conversationId);
  } catch (error) {
    const savedMessages = messageHistoryStore.readSavedMessagesInConversation(conversationId);
    if (!isNetworkFailureError(error) || savedMessages.length === 0) throw error;
  }
  return messageHistoryStore.readSavedMessagesInConversation(conversationId);
}

export async function fetchConversationListAndSaveLocally(filter: ConversationFilter): Promise<Conversation[]> {
  try {
    const conversations = await messagesService.fetchConversationList(filter);
    messageHistoryStore.saveConversations(conversations);
    return [...conversations];
  } catch (error) {
    const savedConversations = messageHistoryStore.readSavedConversations(filter);
    if (!isNetworkFailureError(error) || savedConversations.length === 0) throw error;
    return savedConversations;
  }
}

export const savePendingOutgoingMessageLocally = messageHistoryStore.savePendingOutgoingMessage;
export const replacePendingMessageWithDeliveredMessageLocally = messageHistoryStore.replacePendingMessageWithDeliveredMessage;
export const deleteAllLocallySavedMessageHistory = messageHistoryStore.deleteAllSavedMessageHistory;
export const deleteLocalMessage = messageHistoryStore.deleteLocalMessage;
export const markPendingMessageAsFailedLocally = messageHistoryStore.markPendingMessageAsFailed;
