import { openDatabaseSync, type SQLiteDatabase } from "expo-sqlite";

import type { Conversation, ConversationFilter, Message, UserSummary } from "@/types";

import { buildMessageSyncCursor, type LocalMessageDeliveryStatus, type LocallyStoredMessage, type MessageHistoryStore } from "./messageHistory.type";

const MAXIMUM_SAVED_MESSAGES_PER_CONVERSATION = 500;

interface SavedConversationRow {
  readonly id: string;
  readonly peer_json: string;
  readonly last_message: string;
  readonly last_message_at: string;
  readonly unread: number;
  readonly is_friend: number;
}

interface SavedMessageRow {
  readonly id: string;
  readonly conversation_id: string;
  readonly sender_id: string;
  readonly text: string;
  readonly created_at: string;
  readonly delivery_status: LocalMessageDeliveryStatus;
}

let openedMessageHistoryDatabase: SQLiteDatabase | null = null;

function openMessageHistoryDatabaseAndCreateTables(): SQLiteDatabase {
  if (openedMessageHistoryDatabase) return openedMessageHistoryDatabase;
  const database = openDatabaseSync("zudomartMessageHistory.db");
  database.execSync(`
    PRAGMA journal_mode = WAL;
    CREATE TABLE IF NOT EXISTS conversations (
      id TEXT PRIMARY KEY NOT NULL,
      peer_json TEXT NOT NULL,
      last_message TEXT NOT NULL,
      last_message_at TEXT NOT NULL,
      unread INTEGER NOT NULL DEFAULT 0,
      is_friend INTEGER NOT NULL DEFAULT 0
    );
    CREATE TABLE IF NOT EXISTS messages (
      id TEXT PRIMARY KEY NOT NULL,
      conversation_id TEXT NOT NULL,
      sender_id TEXT NOT NULL,
      text TEXT NOT NULL,
      created_at TEXT NOT NULL,
      delivery_status TEXT NOT NULL DEFAULT 'sent'
    );
    CREATE INDEX IF NOT EXISTS messages_by_conversation_and_time ON messages (conversation_id, created_at, id);
  `);
  openedMessageHistoryDatabase = database;
  return database;
}

const convertRowToConversation = (row: SavedConversationRow): Conversation => ({
  id: row.id,
  peer: JSON.parse(row.peer_json) as UserSummary,
  lastMessage: row.last_message,
  lastMessageAt: row.last_message_at,
  unread: row.unread,
  isFriend: row.is_friend === 1,
});

const convertRowToMessage = (row: SavedMessageRow): LocallyStoredMessage => ({
  id: row.id,
  conversationId: row.conversation_id,
  senderId: row.sender_id,
  text: row.text,
  createdAt: row.created_at,
  deliveryStatus: row.delivery_status,
});

function insertOrReplaceMessageRow(database: SQLiteDatabase, message: Message, deliveryStatus: LocalMessageDeliveryStatus) {
  database.runSync(
    "INSERT OR REPLACE INTO messages (id, conversation_id, sender_id, text, created_at, delivery_status) VALUES (?, ?, ?, ?, ?, ?)",
    message.id,
    message.conversationId,
    message.senderId,
    message.text,
    message.createdAt,
    deliveryStatus,
  );
}

function deleteOldestMessagesBeyondLimit(database: SQLiteDatabase, conversationId: string) {
  database.runSync(
    `DELETE FROM messages WHERE conversation_id = ? AND delivery_status = 'sent' AND id NOT IN (
      SELECT id FROM messages WHERE conversation_id = ? ORDER BY created_at DESC, id DESC LIMIT ?
    )`,
    conversationId,
    conversationId,
    MAXIMUM_SAVED_MESSAGES_PER_CONVERSATION,
  );
}

function runSafelyOrReturnFallback<T>(operation: (database: SQLiteDatabase) => T, fallback: T): T {
  try {
    return operation(openMessageHistoryDatabaseAndCreateTables());
  } catch {
    return fallback;
  }
}

export const messageHistoryStore: MessageHistoryStore = {
  isPersistentStorageAvailable: true,
  readSavedConversations: (filter: ConversationFilter) =>
    runSafelyOrReturnFallback(
      (database) =>
        database
          .getAllSync<SavedConversationRow>(
            `SELECT * FROM conversations ${filter === "direct" ? "WHERE is_friend = 1" : ""} ORDER BY last_message_at DESC`,
          )
          .map(convertRowToConversation),
      [],
    ),
  saveConversations: (conversations) =>
    runSafelyOrReturnFallback((database) => {
      database.withTransactionSync(() => {
        for (const conversation of conversations) {
          database.runSync(
            "INSERT OR REPLACE INTO conversations (id, peer_json, last_message, last_message_at, unread, is_friend) VALUES (?, ?, ?, ?, ?, ?)",
            conversation.id,
            JSON.stringify(conversation.peer),
            conversation.lastMessage,
            conversation.lastMessageAt,
            conversation.unread,
            conversation.isFriend ? 1 : 0,
          );
        }
      });
    }, undefined),
  readSavedMessagesInConversation: (conversationId) =>
    runSafelyOrReturnFallback(
      (database) =>
        database
          .getAllSync<SavedMessageRow>("SELECT * FROM messages WHERE conversation_id = ? ORDER BY created_at ASC, id ASC", conversationId)
          .map(convertRowToMessage),
      [],
    ),
  readLatestSyncCursorForConversation: (conversationId) =>
    runSafelyOrReturnFallback((database) => {
      const latestDeliveredMessage = database.getFirstSync<SavedMessageRow>(
        "SELECT * FROM messages WHERE conversation_id = ? AND delivery_status = 'sent' ORDER BY created_at DESC, id DESC LIMIT 1",
        conversationId,
      );
      return latestDeliveredMessage ? buildMessageSyncCursor(convertRowToMessage(latestDeliveredMessage)) : null;
    }, null),
  saveDeliveredMessages: (messages) =>
    runSafelyOrReturnFallback((database) => {
      database.withTransactionSync(() => {
        for (const message of messages) insertOrReplaceMessageRow(database, message, "sent");
        for (const conversationId of new Set(messages.map((message) => message.conversationId))) {
          deleteOldestMessagesBeyondLimit(database, conversationId);
        }
      });
    }, undefined),
  savePendingOutgoingMessage: (message) =>
    runSafelyOrReturnFallback((database) => insertOrReplaceMessageRow(database, message, "pending"), undefined),
  replacePendingMessageWithDeliveredMessage: (localMessageId, deliveredMessage) =>
    runSafelyOrReturnFallback((database) => {
      database.withTransactionSync(() => {
        database.runSync("DELETE FROM messages WHERE id = ?", localMessageId);
        insertOrReplaceMessageRow(database, deliveredMessage, "sent");
      });
    }, undefined),
  markPendingMessageAsFailed: (localMessageId) =>
    runSafelyOrReturnFallback(
      (database) => database.runSync("UPDATE messages SET delivery_status = 'failed' WHERE id = ?", localMessageId),
      undefined,
    ),
  deleteAllSavedMessageHistory: () =>
    runSafelyOrReturnFallback((database) => database.execSync("DELETE FROM messages; DELETE FROM conversations;"), undefined),
};
