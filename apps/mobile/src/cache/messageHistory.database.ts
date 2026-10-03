import { openDatabaseSync, type SQLiteDatabase } from "expo-sqlite";

import type { Conversation, ConversationFilter, Message, UserSummary } from "@/types";

import { buildMessageSyncCursor, type LocalMessageDeliveryStatus, type LocallyStoredMessage, type MessageHistoryStore } from "./messageHistory.type";

const MAXIMUM_SAVED_MESSAGES_PER_CONVERSATION = 500;
const MESSAGE_HISTORY_SCHEMA_VERSION = 2;

interface SavedConversationRow {
  readonly id: string;
  readonly peer_json: string;
  readonly last_message: string;
  readonly last_message_at: string;
  readonly unread: number;
  readonly is_friend: number;
  readonly extra_json: string | null;
}

interface SavedMessageRow {
  readonly id: string;
  readonly conversation_id: string;
  readonly sender_id: string;
  readonly text: string;
  readonly created_at: string;
  readonly delivery_status: LocalMessageDeliveryStatus;
  readonly kind: string | null;
  readonly extra_json: string | null;
}

type ConversationExtras = Omit<Conversation, "id" | "peer" | "lastMessage" | "lastMessageAt" | "unread" | "isFriend">;
type MessageExtras = Pick<Message, "sender" | "media" | "reactions" | "expiresAt" | "mediaExpiresAt" | "linkPreview" | "sharedContent" | "location" | "document" | "poll" | "readAt" | "encryption">;

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
  migrateMessageHistorySchemaToLatestVersion(database);
  openedMessageHistoryDatabase = database;
  return database;
}

function migrateMessageHistorySchemaToLatestVersion(database: SQLiteDatabase) {
  const currentVersion = database.getFirstSync<{ user_version: number }>("PRAGMA user_version")?.user_version ?? 0;
  if (currentVersion >= MESSAGE_HISTORY_SCHEMA_VERSION) return;
  database.withTransactionSync(() => {
    if (currentVersion < 2) {
      database.execSync(`
        ALTER TABLE messages ADD COLUMN kind TEXT NOT NULL DEFAULT 'text';
        ALTER TABLE messages ADD COLUMN extra_json TEXT;
        ALTER TABLE conversations ADD COLUMN extra_json TEXT;
      `);
    }
    database.execSync(`PRAGMA user_version = ${MESSAGE_HISTORY_SCHEMA_VERSION}`);
  });
}

const parseJsonOrEmptyObject = <T extends object>(json: string | null): Partial<T> => {
  if (!json) return {};
  try {
    return JSON.parse(json) as Partial<T>;
  } catch {
    return {};
  }
};

const extractConversationExtras = ({ id: _id, peer: _peer, lastMessage: _last, lastMessageAt: _at, unread: _unread, isFriend: _friend, ...extras }: Conversation): ConversationExtras => extras;

const extractMessageExtras = (message: Message): MessageExtras => ({
  sender: message.sender,
  media: message.media,
  reactions: message.reactions,
  expiresAt: message.expiresAt,
  mediaExpiresAt: message.mediaExpiresAt,
  linkPreview: message.linkPreview,
  sharedContent: message.sharedContent,
  location: message.location,
  document: message.document,
  poll: message.poll,
  readAt: message.readAt,
  encryption: message.encryption,
});

const hasMessageExpired = (message: Pick<Message, "expiresAt">) => !!message.expiresAt && message.expiresAt <= new Date().toISOString();

const convertRowToConversation = (row: SavedConversationRow): Conversation => ({
  ...parseJsonOrEmptyObject<ConversationExtras>(row.extra_json),
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
  kind: (row.kind ?? "text") as Message["kind"],
  ...parseJsonOrEmptyObject<MessageExtras>(row.extra_json),
});

function insertOrReplaceMessageRow(database: SQLiteDatabase, message: Message, deliveryStatus: LocalMessageDeliveryStatus) {
  database.runSync(
    "INSERT OR REPLACE INTO messages (id, conversation_id, sender_id, text, created_at, delivery_status, kind, extra_json) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
    message.id,
    message.conversationId,
    message.senderId,
    message.text,
    message.createdAt,
    deliveryStatus,
    message.kind ?? "text",
    JSON.stringify(extractMessageExtras(message)),
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
            "INSERT OR REPLACE INTO conversations (id, peer_json, last_message, last_message_at, unread, is_friend, extra_json) VALUES (?, ?, ?, ?, ?, ?, ?)",
            conversation.id,
            JSON.stringify(conversation.peer),
            conversation.lastMessage,
            conversation.lastMessageAt,
            conversation.unread,
            conversation.isFriend ? 1 : 0,
            JSON.stringify(extractConversationExtras(conversation)),
          );
        }
      });
    }, undefined),
  readSavedMessagesInConversation: (conversationId) =>
    runSafelyOrReturnFallback(
      (database) =>
        database
          .getAllSync<SavedMessageRow>("SELECT * FROM messages WHERE conversation_id = ? ORDER BY created_at ASC, id ASC", conversationId)
          .map(convertRowToMessage)
          .filter((message) => !hasMessageExpired(message)),
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
  deleteLocalMessage: (localMessageId) =>
    runSafelyOrReturnFallback((database) => database.runSync("DELETE FROM messages WHERE id = ?", localMessageId), undefined),
  deleteExpiredMessages: () =>
    runSafelyOrReturnFallback(
      (database) =>
        database.runSync(
          "DELETE FROM messages WHERE json_extract(extra_json, '$.expiresAt') IS NOT NULL AND json_extract(extra_json, '$.expiresAt') <= ?",
          new Date().toISOString(),
        ),
      undefined,
    ),
  deleteAllSavedMessageHistory: () =>
    runSafelyOrReturnFallback((database) => database.execSync("DELETE FROM messages; DELETE FROM conversations;"), undefined),
};
