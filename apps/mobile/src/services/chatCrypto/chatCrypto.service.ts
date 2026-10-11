import { ChatCryptoClient, type ChatPayload, type ChatPayloadInput, createHttpKeyDirectory, describeDecryptionFailure, type EncryptedOutgoingMessage, type GroupAttributes } from "@zudomart/chat-crypto";

import { registerSignOutHook, useAuthStore } from "@/store/auth.store";
import type { Conversation, Message } from "@/types";

import { api, ApiError } from "../core/apiClient.service";
import { createMobileChatCryptoStorage, randomBytesFromDevice } from "./mobileKeyStore";

let client: ChatCryptoClient | null = null;

const directory = createHttpKeyDirectory({
  get: (path) => api.get(path),
  post: (path, body) => api.post(path, body),
  put: (path, body) => api.put(path, body),
  delete: async (path) => void (await api.delete(path)),
  isNotFound: (error) => error instanceof ApiError && error.status === 404,
});

const getClient = () => (client ??= new ChatCryptoClient({ storage: createMobileChatCryptoStorage(), directory, random: randomBytesFromDevice }));

export async function resolveSignedInUserId(): Promise<string> {
  const cached = useAuthStore.getState().user?.id;
  if (cached) return cached;
  const viewer = await api.get<{ readonly id: string }>("/api/v1/users/me");
  return viewer.id;
}

async function readyClient() {
  const current = getClient();
  await current.ensureReady(await resolveSignedInUserId());
  return current;
}

export const usesGroupEncryption = (conversation: Conversation) => conversation.kind === "group" || conversation.kind === "business";

async function memberUserIdsOf(conversation: Conversation): Promise<string[]> {
  return [...(await api.get<{ readonly userIds: readonly string[] }>(`/api/v1/conversations/${conversation.id}/recipients`)).userIds];
}

const isServerDocumentStub = (message: Message) => !!message.document && typeof (message.document as { fileName?: unknown }).fileName !== "string";

export function messageFieldsFromPayload(message: Message, payload: ChatPayload): Partial<Message> {
  const attachment = payload.attachment ?? null;
  const document = message.kind === "document" ? (attachment ? { fileName: attachment.fileName ?? "Document", mimeType: attachment.contentType, sizeBytes: attachment.sizeBytes, pageCount: attachment.pageCount ?? null, url: message.document?.url ?? null } : null) : undefined;
  const location = payload.location ? { latitude: payload.location.latitude, longitude: payload.location.longitude, address: payload.location.label, liveUntil: payload.location.liveUntil ?? null } : null;
  return {
    text: payload.text, linkPreview: payload.linkPreview ?? null, attachment, location, pollDefinition: payload.poll ?? null, control: payload.control ?? null,
    sharedReference: (payload.sharedContent as Message["sharedReference"]) ?? null,
    ...(document === undefined ? {} : { document }),
  };
}

export const chatCryptoService = {
  ensureReady: () => readyClient().then(() => undefined),
  encryptForConversation: async (conversation: Conversation, input: ChatPayloadInput): Promise<EncryptedOutgoingMessage> => {
    const ready = await readyClient();
    const kind = usesGroupEncryption(conversation) ? "group" : "direct";
    return ready.encryptMessage({ kind, conversationId: conversation.id, memberUserIds: await memberUserIdsOf(conversation) }, input);
  },
  encryptForConversationId: async (conversationId: string, input: ChatPayloadInput): Promise<EncryptedOutgoingMessage> =>
    chatCryptoService.encryptForConversation(await api.get<Conversation>(`/api/v1/conversations/${conversationId}`), input),
  encryptForUser: async (userId: string, input: ChatPayloadInput): Promise<EncryptedOutgoingMessage> =>
    (await readyClient()).encryptMessage({ kind: "direct", conversationId: null, memberUserIds: [userId] }, input),
  decryptMessages: async <T extends Message>(messages: readonly T[]): Promise<T[]> => {
    void client?.purgeExpiredPlaintext().catch(() => undefined);
    if (!messages.some((message) => message.encryption?.ciphertext)) return messages.map((message) => ({ ...message, linkPreview: typeof message.linkPreview === "string" ? null : (message.linkPreview ?? null), ...(isServerDocumentStub(message) ? { document: null } : {}) }));
    const results = await (await readyClient()).decryptMessages(messages);
    return messages.map((message) => {
      const result = results.get(message.id);
      const plainPreview = typeof message.linkPreview === "string" ? null : (message.linkPreview ?? null);
      if (result === undefined || result.status === "unencrypted") return { ...message, linkPreview: plainPreview, ...(isServerDocumentStub(message) ? { document: null } : {}) };
      if (result.status === "failed") return { ...message, text: "", linkPreview: null, document: null, location: null, pollDefinition: null, control: null, decryptionNotice: describeDecryptionFailure(result.reason) };
      return { ...message, ...messageFieldsFromPayload(message, result.payload), decryptionNotice: null };
    });
  },
  prepareNewGroup: async (attributes: GroupAttributes) => (await readyClient()).prepareNewGroup(attributes),
  rememberGroupKey: async (conversationId: string, groupKey: string) => (await readyClient()).rememberGroupKey(conversationId, groupKey),
  sealGroupAttributes: async (conversationId: string, attributes: GroupAttributes, options: { readonly rotate?: boolean } = {}) =>
    (await readyClient()).sealGroupAttributes(conversationId, attributes, options),
  openGroupAttributes: async (conversationId: string, sealed: string | null | undefined) => (sealed ? (await readyClient()).openGroupAttributes(conversationId, sealed) : null),
  forgetMessages: (messageIds: readonly string[]) => client?.forgetMessages(messageIds) ?? Promise.resolve(),
  identityChanges: async (userIds: readonly string[]) => (await readyClient()).identityChanges(userIds),
  acknowledgeIdentityChange: async (userId: string) => (await readyClient()).acknowledgeIdentityChange(userId),
  securityCode: async (userId: string) => (await readyClient()).securityCode(userId),
  signOut: async () => {
    await getClient().signOut({ removeFromDirectory: true }).catch(() => undefined);
    client = null;
  },
};

registerSignOutHook(() => chatCryptoService.signOut());

export const readChatCryptoErrorMessage = (error: unknown): string | null => {
  const code = (error as { code?: string } | null)?.code;
  if (code === "NO_RECIPIENT_DEVICES") return "They haven't set up secure chat yet. Ask them to open Zudomart, then try again.";
  if (code === "ENVELOPE_TOO_LARGE") return "This group has too many devices for one encrypted message.";
  if (code === "NOT_REGISTERED") return "Secure chat isn't set up on this device yet. Try again in a moment.";
  return null;
};
