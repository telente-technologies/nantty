import { openDatabaseSync, type SQLiteDatabase } from "expo-sqlite";

import type { Conversation, ConversationFilter, Message, UserSummary } from "@/types";
import { openLocalText, sealLocalText } from "@/utils/localDataSealing.util";

import { buildMessageSyncCursor, type LocalMessageDeliveryStatus, type LocallyStoredMessage, type MessageHistoryStore } from "./messageHistory.type";

const MAXIMUM_SAVED_MESSAGES_PER_CONVERSATION = 500;
const MESSAGE_HISTORY_SCHEMA_VERSION = 3;

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
  readonly expires_at?: string | null;
}

type ConversationExtras = Omit<Conversation, "id" | "peer" | "lastMessage" | "lastMessageAt" | "unread" | "isFriend">;
type MessageExtras = Pick<Message, "sender" | "media" | "reactions" | "expiresAt" | "mediaExpiresAt" | "linkPreview" | "sharedContent" | "location" | "document" | "poll" | "readAt" | "encryption" | "mentions" | "decryptionNotice" | "attachment">;

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
    if (currentVersion < 3) {
      database.execSync("ALTER TABLE messages ADD COLUMN expires_at TEXT;");
      sealExistingPlaintextRows(database);
    }
    database.execSync(`PRAGMA user_version = ${MESSAGE_HISTORY_SCHEMA_VERSION}`);
  });
}

const messageColumnContext = (id: string, column: string) => `messageHistory:message:${id}:${column}`;
const conversationColumnContext = (id: string, column: string) => `messageHistory:conversation:${id}:${column}`;

function sealExistingPlaintextRows(database: SQLiteDatabase) {
  for (const row of database.getAllSync<SavedMessageRow>("SELECT * FROM messages")) {
    const extras = parseJsonOrEmptyObject<MessageExtras>(row.extra_json);
    database.runSync(
      "UPDATE messages SET text = ?, extra_json = ?, expires_at = ? WHERE id = ?",
      sealLocalText(row.text, messageColumnContext(row.id, "text")),
      sealLocalText(row.extra_json ?? "{}", messageColumnContext(row.id, "extra")),
      extras.expiresAt ?? null,
      row.id,
    );
  }
  for (const row of database.getAllSync<SavedConversationRow>("SELECT * FROM conversations")) {
    database.runSync(
      "UPDATE conversations SET peer_json = ?, last_message = ?, extra_json = ? WHERE id = ?",
      sealLocalText(row.peer_json, conversationColumnContext(row.id, "peer")),
      sealLocalText(row.last_message, conversationColumnContext(row.id, "lastMessage")),
      sealLocalText(row.extra_json ?? "{}", conversationColumnContext(row.id, "extra")),
      row.id,
    );
  }
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
  mentions: message.mentions,
  decryptionNotice: message.decryptionNotice,
  attachment: message.attachment,
});

const hasMessageExpired = (message: Pick<Message, "expiresAt">) => !!message.expiresAt && message.expiresAt <= new Date().toISOString();

const convertRowToConversation = (row: SavedConversationRow): Conversation => ({
  ...parseJsonOrEmptyObject<ConversationExtras>(row.extra_json === null ? null : openLocalText(row.extra_json, conversationColumnContext(row.id, "extra"))),
  id: row.id,
  peer: JSON.parse(openLocalText(row.peer_json, conversationColumnContext(row.id, "peer")) || "{}") as UserSummary,
  lastMessage: openLocalText(row.last_message, conversationColumnContext(row.id, "lastMessage")),
  lastMessageAt: row.last_message_at,
  unread: row.unread,
  isFriend: row.is_friend === 1,
});

const convertRowToMessage = (row: SavedMessageRow): LocallyStoredMessage => ({
  id: row.id,
  conversationId: row.conversation_id,
  senderId: row.sender_id,
  text: openLocalText(row.text, messageColumnContext(row.id, "text")),
  createdAt: row.created_at,
  deliveryStatus: row.delivery_status,
  kind: (row.kind ?? "text") as Message["kind"],
  ...parseJsonOrEmptyObject<MessageExtras>(row.extra_json === null ? null : openLocalText(row.extra_json, messageColumnContext(row.id, "extra"))),
});

function insertOrReplaceMessageRow(database: SQLiteDatabase, message: Message, deliveryStatus: LocalMessageDeliveryStatus) {
  database.runSync(
    "INSERT OR REPLACE INTO messages (id, conversation_id, sender_id, text, created_at, delivery_status, kind, extra_json, expires_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
    message.id,
    message.conversationId,
    message.senderId,
    sealLocalText(message.text, messageColumnContext(message.id, "text")),
    message.createdAt,
    deliveryStatus,
    message.kind ?? "text",
    sealLocalText(JSON.stringify(extractMessageExtras(message)), messageColumnContext(message.id, "extra")),
    message.expiresAt ?? null,
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
            sealLocalText(JSON.stringify(conversation.peer), conversationColumnContext(conversation.id, "peer")),
            sealLocalText(conversation.lastMessage, conversationColumnContext(conversation.id, "lastMessage")),
            conversation.lastMessageAt,
            conversation.unread,
            conversation.isFriend ? 1 : 0,
            sealLocalText(JSON.stringify(extractConversationExtras(conversation)), conversationColumnContext(conversation.id, "extra")),
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
          "DELETE FROM messages WHERE expires_at IS NOT NULL AND expires_at <= ?",
          new Date().toISOString(),
        ),
      undefined,
    ),
  deleteAllSavedMessageHistory: () =>
    runSafelyOrReturnFallback((database) => database.execSync("DELETE FROM messages; DELETE FROM conversations;"), undefined),
};
