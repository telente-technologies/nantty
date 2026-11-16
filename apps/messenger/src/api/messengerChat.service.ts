import { ChatCryptoClient, type AttachmentPointer, type ChatControl, type ChatCryptoStorage, type KeyValueStore, SealedKeyValueStore, createAeadSealer, createHttpKeyDirectory, decodeBase64, encodeBase64 } from "@nantty/chat-crypto";
import * as Crypto from "expo-crypto";
import * as SecureStore from "expo-secure-store";
import { openDatabaseSync, type SQLiteDatabase } from "expo-sqlite";

import { ApiError, type ApiRequestOptions } from "./apiClient";
import type { ConversationSummary } from "./conversations";
import { messengerStoriesService } from "./messengerStories.service";
import { parseMessagePagePayload } from "./messagePage.util";
import { createBubbleDraftStore } from "./bubbleDrafts.store";

export interface MessengerMessage {
  readonly id: string;
  readonly conversationId: string;
  readonly senderId: string;
  readonly text: string;
  readonly createdAt: string;
  readonly readAt?: string | null;
  readonly decryptionNotice?: string | null;
  readonly kind?: string;
  readonly control?: ChatControl | null;
  readonly attachment?: AttachmentPointer | null;
  readonly media?: { readonly id: string; readonly type: "image" | "video" | "voice"; readonly url: string | null } | null;
  readonly deliveryStatus?: "sending" | "sent" | "failed";
}

export interface MessengerMessagePage {
  readonly data: readonly MessengerMessage[];
  readonly nextCursor: string | null;
}

interface PendingEncryptedMessage {
  readonly idempotencyKey: string;
  readonly conversationId: string;
  readonly senderId: string;
  readonly text: string;
  readonly createdAt: string;
  readonly body: { readonly kind: "text"; readonly encryption: { readonly deviceId: string; readonly ciphertext: string; readonly protocol: string }; readonly linkPreview?: string | null };
  readonly storyReply?: { readonly storyId: string; readonly recipientId: string };
}

export type MessengerRequest = <T>(path: string, options?: Omit<ApiRequestOptions, "accessToken">) => Promise<T>;
type KeyValueOperation = Parameters<NonNullable<KeyValueStore["batch"]>>[0][number];

const storagePrefix = "nantty.messenger.chatCrypto.";
const secureIndexKey = `${storagePrefix}index`;
const storageKeyName = `${storagePrefix}storageKey`;
const databaseName = "nanttyMessengerChatCrypto.db";

function secureStoreKey(key: string): string {
  return `${storagePrefix}${key.replace(/[^A-Za-z0-9._-]/g, "_")}`;
}

class SecureKeyValueStore implements KeyValueStore {
  private async readIndex(): Promise<string[]> {
    const value = await SecureStore.getItemAsync(secureIndexKey);
    return value === null ? [] : JSON.parse(value) as string[];
  }

  public get(key: string) { return SecureStore.getItemAsync(secureStoreKey(key)); }

  public async set(key: string, value: string) {
    await SecureStore.setItemAsync(secureStoreKey(key), value);
    const keys = await this.readIndex();
    if (!keys.includes(key)) await SecureStore.setItemAsync(secureIndexKey, JSON.stringify([...keys, key]));
  }

  public async delete(key: string) {
    await SecureStore.deleteItemAsync(secureStoreKey(key));
    await SecureStore.setItemAsync(secureIndexKey, JSON.stringify((await this.readIndex()).filter((entry) => entry !== key)));
  }

  public async keys(prefix: string) { return (await this.readIndex()).filter((key) => key.startsWith(prefix)); }
}

let database: SQLiteDatabase | undefined;
function recordsDatabase(): SQLiteDatabase {
  if (database) return database;
  database = openDatabaseSync(databaseName);
  database.execSync("PRAGMA journal_mode = WAL; CREATE TABLE IF NOT EXISTS records (key TEXT PRIMARY KEY NOT NULL, value TEXT NOT NULL);");
  return database;
}

class SqliteKeyValueStore implements KeyValueStore {
  public async get(key: string) { return recordsDatabase().getFirstSync<{ value: string }>("SELECT value FROM records WHERE key = ?", [key])?.value ?? null; }
  public async set(key: string, value: string) { recordsDatabase().runSync("INSERT OR REPLACE INTO records (key, value) VALUES (?, ?)", [key, value]); }
  public async delete(key: string) { recordsDatabase().runSync("DELETE FROM records WHERE key = ?", [key]); }
  public async keys(prefix: string) { return recordsDatabase().getAllSync<{ key: string }>("SELECT key FROM records WHERE substr(key, 1, ?) = ?", [prefix.length, prefix]).map(({ key }) => key); }
  public async batch(operations: readonly KeyValueOperation[]) {
    recordsDatabase().withTransactionSync(() => {
      for (const operation of operations) {
        if (operation.type === "set") recordsDatabase().runSync("INSERT OR REPLACE INTO records (key, value) VALUES (?, ?)", [operation.key, operation.value]);
        else recordsDatabase().runSync("DELETE FROM records WHERE key = ?", [operation.key]);
      }
    });
  }
}

const randomBytes = (length: number) => Crypto.getRandomBytes(length);
async function readStorageKey(): Promise<Uint8Array> {
  const existing = await SecureStore.getItemAsync(storageKeyName);
  if (existing) return decodeBase64(existing);
  const created = randomBytes(32);
  await SecureStore.setItemAsync(storageKeyName, encodeBase64(created));
  return created;
}

class LazySealedRecordStore implements KeyValueStore {
  private readonly ready = readStorageKey().then((key) => new SealedKeyValueStore(new SqliteKeyValueStore(), createAeadSealer(key, randomBytes)));
  public async get(key: string) { return (await this.ready).get(key); }
  public async set(key: string, value: string) { return (await this.ready).set(key, value); }
  public async delete(key: string) { return (await this.ready).delete(key); }
  public async keys(prefix: string) { return (await this.ready).keys(prefix); }
  public async batch(operations: readonly KeyValueOperation[]) { return (await this.ready).batch(operations); }
}

let cryptoClient: ChatCryptoClient | null = null;
let cachedUserId: string | null = null;
const sentPlaintextCache = (messageId: string) => `sentMessage:${messageId}`;
const outboxKey = (idempotencyKey: string) => `outbox:${idempotencyKey}`;
const confirmationCallbacks = new Map<string, (messageId: string) => Promise<void>>();
const outboxStore = new LazySealedRecordStore();
const bubbleDraftStore = createBubbleDraftStore(outboxStore);

function getCryptoClient(request: MessengerRequest): ChatCryptoClient {
  if (cryptoClient) return cryptoClient;
  const transport = {
    get: <T,>(path: string) => request<T>(path, { method: "GET" }),
    post: <T,>(path: string, body: unknown) => request<T>(path, { method: "POST", body }),
    put: <T,>(path: string, body: unknown) => request<T>(path, { method: "PUT", body }),
    delete: async (path: string) => { await request<void>(path, { method: "DELETE" }); },
    isNotFound: (error: unknown) => error instanceof ApiError && error.status === 404,
  };
  const directory = createHttpKeyDirectory(transport);
  const storage: ChatCryptoStorage = { secrets: new SecureKeyValueStore(), records: new LazySealedRecordStore() };
  cryptoClient = new ChatCryptoClient({ storage, directory, random: randomBytes });
  return cryptoClient;
}

export async function ensureMessengerEncryption(request: MessengerRequest): Promise<string> {
  const viewer = await request<{ readonly id: string }>("/api/v1/users/me");
  if (!viewer.id) throw new ApiError("Could not verify your Nantty account for secure chat.", null, "CHAT_IDENTITY_UNAVAILABLE");
  await getCryptoClient(request).ensureReady(viewer.id);
  cachedUserId = viewer.id;
  return viewer.id;
}

export async function fetchEncryptedMessagePage(request: MessengerRequest, conversationId: string, cursor?: string, limit = 35): Promise<MessengerMessagePage> {
  const userId = cachedUserId ?? await ensureMessengerEncryption(request);
  const query = new URLSearchParams({ limit: String(limit), ...(cursor ? { cursor } : {}) });
  const response = await request<unknown>(`/api/v1/conversations/${encodeURIComponent(conversationId)}/messages?${query.toString()}`);
  const page = parseMessagePagePayload(response);
  const values = page.data;
  const incoming = values.filter(isMessageRecord);
  const decrypted = await getCryptoClient(request).decryptMessages(incoming);
  const restored = await Promise.all(incoming.map(async (message) => {
    const result = decrypted.get(message.id);
    if (result?.status === "decrypted") return { ...message, text: result.payload.text, control: result.payload.control ?? null, attachment: result.payload.attachment ?? null };
    if (message.senderId === userId) {
      const ownText = await outboxStore.get(sentPlaintextCache(message.id));
      if (ownText !== null) return { ...message, text: ownText };
    }
    if (message.encryption?.ciphertext) return { ...message, text: "", decryptionNotice: result?.status === "failed" ? "This message could not be decrypted on this device." : "" };
    return { ...message, text: "", control: null, decryptionNotice: "This message is not available as an encrypted message." };
  }));
  return {
    data: restored.filter((message) => message.kind === "control" || message.senderId === userId || message.text.length > 0 || message.decryptionNotice !== ""),
    nextCursor: page.nextCursor,
  };
}

export async function fetchEncryptedMessages(request: MessengerRequest, conversationId: string, limit = 35): Promise<readonly MessengerMessage[]> {
  return (await fetchEncryptedMessagePage(request, conversationId, undefined, limit)).data;
}

function isMessageRecord(value: unknown): value is MessengerMessage & { encryption?: { readonly deviceId: string; readonly ciphertext: string | null; readonly protocol?: string } | null } {
  if (value === null || typeof value !== "object") return false;
  const candidate = value as Partial<MessengerMessage> & { encryption?: unknown };
  return typeof candidate.id === "string" && typeof candidate.conversationId === "string" && typeof candidate.senderId === "string" && typeof candidate.createdAt === "string";
}

export async function sendEncryptedText(request: MessengerRequest, conversation: ConversationSummary, text: string, idempotencyKey: string): Promise<MessengerMessage> {
  const normalizedText = text.trim();
  const senderId = await ensureMessengerEncryption(request);
  if (!normalizedText || normalizedText.length > 4000 || !idempotencyKey) throw new ApiError("Enter a valid message before sending.", null, "INVALID_MESSAGE");
  const key = outboxKey(idempotencyKey);
  let pending = await outboxStore.get(key).then((value) => value === null ? null : JSON.parse(value) as PendingEncryptedMessage);
  if (pending !== null && (pending.senderId !== senderId || pending.conversationId !== conversation.id || pending.text !== normalizedText || pending.storyReply !== undefined)) {
    throw new ApiError("This message key is already associated with a different message.", null, "IDEMPOTENCY_KEY_CONFLICT");
  }
  if (pending === null) {
    const recipients = await request<{ readonly userIds: readonly string[] }>(`/api/v1/conversations/${encodeURIComponent(conversation.id)}/recipients`);
    const group = conversation.kind === "group" || conversation.kind === "channel" || conversation.kind === "business";
    const encrypted = await getCryptoClient(request).encryptMessage({ kind: group ? "group" : "direct", conversationId: conversation.id, memberUserIds: [...recipients.userIds] }, { text: normalizedText });
    pending = {
      idempotencyKey,
      conversationId: conversation.id,
      senderId,
      text: normalizedText,
      createdAt: new Date().toISOString(),
      body: { kind: "text", encryption: encrypted.encryption, ...(encrypted.linkPreview ? { linkPreview: encrypted.linkPreview } : {}) },
    };
    confirmationCallbacks.set(idempotencyKey, (messageId) => encrypted.confirmSent(messageId, null));
    await outboxStore.set(key, JSON.stringify(pending));
  }
  return deliverPendingMessage(request, pending);
}

export async function sendEncryptedStoryReply(request: MessengerRequest, recipientId: string, storyId: string, text: string, idempotencyKey: string): Promise<MessengerMessage> {
  const normalizedText = text.trim();
  if (!recipientId || !storyId || !idempotencyKey || !normalizedText || normalizedText.length > 4000) {
    throw new ApiError("Enter a valid Story reply before sending.", null, "INVALID_STORY_REPLY");
  }

  const senderId = await ensureMessengerEncryption(request);
  if (senderId === recipientId) throw new ApiError("You cannot reply to your own Story.", null, "CANNOT_REPLY_TO_OWN_STORY");
  const key = outboxKey(idempotencyKey);
  let pending = await outboxStore.get(key).then((value) => value === null ? null : JSON.parse(value) as PendingEncryptedMessage);
  if (pending !== null) {
    if (pending.senderId !== senderId || pending.storyReply?.storyId !== storyId || pending.storyReply.recipientId !== recipientId || pending.text !== normalizedText) {
      throw new ApiError("This reply is already queued for a different message. Start a new reply.", null, "IDEMPOTENCY_KEY_CONFLICT");
    }
  } else {
    const conversation = await request<{ readonly id: string }>("/api/v1/conversations", { method: "POST", body: { userId: recipientId } });
    if (!conversation.id) throw new ApiError("Could not start a secure conversation for this Story reply.", null, "CONVERSATION_UNAVAILABLE");
    const recipients = await request<{ readonly userIds: readonly string[] }>(`/api/v1/conversations/${encodeURIComponent(conversation.id)}/recipients`);
    const encrypted = await getCryptoClient(request).encryptMessage({ kind: "direct", conversationId: conversation.id, memberUserIds: [...recipients.userIds] }, {
      text: normalizedText,
      storyId,
      sharedContent: { kind: "story", id: storyId },
    });
    pending = {
      idempotencyKey,
      conversationId: conversation.id,
      senderId,
      text: normalizedText,
      createdAt: new Date().toISOString(),
      body: { kind: "text", encryption: encrypted.encryption, ...(encrypted.linkPreview ? { linkPreview: encrypted.linkPreview } : {}) },
      storyReply: { storyId, recipientId },
    };
    confirmationCallbacks.set(idempotencyKey, (messageId) => encrypted.confirmSent(messageId, null));
    await outboxStore.set(key, JSON.stringify(pending));
  }
  return deliverPendingMessage(request, pending);
}

export async function sendEncryptedControl(request: MessengerRequest, conversation: ConversationSummary, control: ChatControl, idempotencyKey: string): Promise<MessengerMessage> {
  const userId = await ensureMessengerEncryption(request);
  const recipients = await request<{ readonly userIds: readonly string[] }>(`/api/v1/conversations/${encodeURIComponent(conversation.id)}/recipients`);
  const group = conversation.kind === "group" || conversation.kind === "channel" || conversation.kind === "business";
  const encrypted = await getCryptoClient(request).encryptMessage({ kind: group ? "group" : "direct", conversationId: conversation.id, memberUserIds: [...recipients.userIds] }, { text: "", control });
  const sent = await request<MessengerMessage>(`/api/v1/conversations/${encodeURIComponent(conversation.id)}/messages`, {
    method: "POST",
    headers: { "Idempotency-Key": idempotencyKey },
    body: { kind: "control", encryption: encrypted.encryption },
  });
  await encrypted.confirmSent(sent.id, null);
  return { ...sent, kind: "control", control, text: "", senderId: userId, deliveryStatus: "sent" };
}

export async function sendEncryptedImage(request: MessengerRequest, conversation: ConversationSummary, mediaId: string, attachment: AttachmentPointer, idempotencyKey: string): Promise<MessengerMessage> {
  const userId = await ensureMessengerEncryption(request);
  const recipients = await request<{ readonly userIds: readonly string[] }>(`/api/v1/conversations/${encodeURIComponent(conversation.id)}/recipients`);
  const group = conversation.kind === "group" || conversation.kind === "channel" || conversation.kind === "business";
  const encrypted = await getCryptoClient(request).encryptMessage({ kind: group ? "group" : "direct", conversationId: conversation.id, memberUserIds: [...recipients.userIds] }, { text: "", attachment });
  const sent = await request<MessengerMessage>(`/api/v1/conversations/${encodeURIComponent(conversation.id)}/messages`, {
    method: "POST",
    headers: { "Idempotency-Key": idempotencyKey },
    body: { kind: "image", mediaId, encryption: encrypted.encryption },
  });
  await encrypted.confirmSent(sent.id, null);
  return { ...sent, kind: "image", attachment, media: sent.media ?? { id: mediaId, type: "image", url: null }, text: "", senderId: userId, deliveryStatus: "sent" };
}

async function deliverPendingMessage(request: MessengerRequest, pending: PendingEncryptedMessage): Promise<MessengerMessage> {
  const sent = pending.storyReply
    ? await messengerStoriesService.replyToStory(request, pending.storyReply.storyId, pending.body.encryption, pending.idempotencyKey)
      .then((result) => ({ ...result, conversationId: pending.conversationId, senderId: pending.senderId, createdAt: pending.createdAt, text: pending.text }))
    : await request<MessengerMessage>(`/api/v1/conversations/${encodeURIComponent(pending.conversationId)}/messages`, {
      method: "POST",
      headers: { "Idempotency-Key": pending.idempotencyKey },
      body: pending.body,
    });
  await confirmationCallbacks.get(pending.idempotencyKey)?.(sent.id).catch(() => undefined);
  confirmationCallbacks.delete(pending.idempotencyKey);
  await outboxStore.set(sentPlaintextCache(sent.id), pending.text);
  await outboxStore.delete(outboxKey(pending.idempotencyKey));
  return { ...sent, text: pending.text, senderId: pending.senderId, deliveryStatus: "sent" };
}

export async function drainEncryptedOutbox(request: MessengerRequest): Promise<void> {
  const keys = await outboxStore.keys("outbox:");
  for (const key of keys) {
    const value = await outboxStore.get(key);
    if (value === null) continue;
    try {
      await deliverPendingMessage(request, JSON.parse(value) as PendingEncryptedMessage);
    } catch {
      break;
    }
  }
}

/*
 * Each queued envelope is encrypted before it reaches SQLite. The local storage key is
 * held in SecureStore, so retries reuse the exact ciphertext and idempotency key.
 */
export async function queueStatusForConversation(conversationId: string): Promise<readonly MessengerMessage[]> {
  const values = await Promise.all((await outboxStore.keys("outbox:")).map((key) => outboxStore.get(key)));
  return values.flatMap((value) => {
    if (value === null) return [];
    try {
      const item = JSON.parse(value) as PendingEncryptedMessage;
      return item.conversationId === conversationId ? [{ id: item.idempotencyKey, conversationId, senderId: item.senderId, text: item.text, createdAt: item.createdAt, deliveryStatus: "sending" as const }] : [];
    } catch { return []; }
  });
}

export async function getBubbleDraft(accountId: string, conversationId: string): Promise<string> {
  return bubbleDraftStore.get(accountId, conversationId);
}

export function saveBubbleDraft(accountId: string, conversationId: string, draft: string): Promise<void> {
  return bubbleDraftStore.save(accountId, conversationId, draft);
}

export async function markConversationRead(request: MessengerRequest, conversationId: string): Promise<void> {
  await request<void>(`/api/v1/conversations/${encodeURIComponent(conversationId)}/read`, { method: "POST" });
}

export async function clearMessengerChatCrypto(): Promise<void> {
  await bubbleDraftStore.flush();
  if (cryptoClient) await cryptoClient.signOut({ removeFromDirectory: true });
  cryptoClient = null;
  cachedUserId = null;
  confirmationCallbacks.clear();
  for (const key of await outboxStore.keys("")) await outboxStore.delete(key);
}
