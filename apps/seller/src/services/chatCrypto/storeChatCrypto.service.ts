import { ChatCryptoClient, type ChatPayloadInput, createHttpKeyDirectory, createWebLocksMutex, describeDecryptionFailure, type EncryptedOutgoingMessage, type KeyValueStore } from "@nantty/chat-crypto";

import { SellerApiRequestError, sendSellerApiRequest } from "@/services/clientApi.service";
import type { ConversationMessage, ConversationMessageKind, ConversationRecipients, DecryptedConversationMessage, DecryptedPreview } from "@/types/conversation.type";
import { withoutPayload, withPayload } from "@/utils/storeChat.util";

import { closeSellerChatCryptoDatabase, createSealedPreviewStore, createSellerChatCryptoStorage, deleteSellerChatCryptoDatabase } from "./sellerKeyStore";

const apiPrefix = /^\/api\/v1/;
const toBffPath = (path: string) => path.replace(apiPrefix, "");

const directory = createHttpKeyDirectory({
  get: (path) => sendSellerApiRequest(toBffPath(path)),
  post: (path, body) => sendSellerApiRequest(toBffPath(path), { method: "POST", body }),
  put: (path, body) => sendSellerApiRequest(toBffPath(path), { method: "PUT", body }),
  delete: (path) => sendSellerApiRequest<void>(toBffPath(path), { method: "DELETE" }),
  isNotFound: (error) => error instanceof SellerApiRequestError && error.status === 404,
});

let client: ChatCryptoClient | null = null;
let previews: KeyValueStore | null = null;
const crossTabLock = createWebLocksMutex("zudomart-seller-chat-crypto");
const getClient = () => (client ??= new ChatCryptoClient({ storage: createSellerChatCryptoStorage(), directory, ...(crossTabLock === undefined ? {} : { lock: crossTabLock }) }));
const getPreviews = () => (previews ??= createSealedPreviewStore());

async function readyClient(viewerId: string): Promise<ChatCryptoClient> {
  const current = getClient();
  await current.ensureReady(viewerId);
  return current;
}

export interface EncryptedSendRequest {
  readonly conversationId: string;
  readonly viewerId: string;
  readonly kind: ConversationMessageKind;
  readonly input: ChatPayloadInput;
  readonly idempotencyKey: string;
  readonly mediaId?: string;
  readonly durationSeconds?: number;
}

export const storeChatCrypto = {
  ensureReady: (viewerId: string) => readyClient(viewerId).then(() => undefined),
  hasDeviceIdentity: (viewerId: string) => getClient().hasDeviceIdentity(viewerId),
  sendEncrypted: async (request: EncryptedSendRequest): Promise<ConversationMessage> => {
    const encrypted = await storeChatCrypto.encryptReply(request.conversationId, request.viewerId, request.input);
    const delivered = await sendSellerApiRequest<ConversationMessage>(`/seller/conversations/${encodeURIComponent(request.conversationId)}/messages`, {
      method: "POST",
      body: {
        kind: request.kind, encryption: encrypted.encryption,
        ...(encrypted.linkPreview ? { linkPreview: encrypted.linkPreview } : {}),
        ...(request.mediaId === undefined ? {} : { mediaId: request.mediaId }),
        ...(request.durationSeconds === undefined ? {} : { durationSeconds: request.durationSeconds }),
      },
      idempotencyKey: request.idempotencyKey,
    });
    await encrypted.confirmSent(delivered.id, delivered.expiresAt ?? null);
    return delivered;
  },
  decryptThread: async (messages: readonly ConversationMessage[], viewerId: string): Promise<DecryptedConversationMessage[]> => {
    const ready = await readyClient(viewerId);
    void ready.purgeExpiredPlaintext().catch(() => undefined);
    const results = await ready.decryptMessages(messages.map((message) => ({ ...message, linkPreview: message.linkPreview ?? undefined })));
    return messages.map((message) => {
      if (message.moderationHidden) return withoutPayload(message, "This message was removed for breaking the rules.");
      const result = results.get(message.id);
      if (result === undefined || result.status === "unencrypted") return withoutPayload(message, "This message can't be shown.");
      if (result.status === "failed") {
        const sentBefore = result.reason === "NOT_FOR_THIS_DEVICE" || result.reason === "NO_SENDER_KEY";
        return withoutPayload(message, sentBefore ? "Sent before this browser joined secure chat, so it can't be read here." : describeDecryptionFailure(result.reason));
      }
      return withPayload(message, result.payload);
    });
  },
  encryptReply: async (conversationId: string, viewerId: string, input: ChatPayloadInput): Promise<EncryptedOutgoingMessage> => {
    const ready = await readyClient(viewerId);
    const recipients = await sendSellerApiRequest<ConversationRecipients>(`/seller/conversations/${encodeURIComponent(conversationId)}/recipients`);
    return ready.encryptMessage({ kind: "group", conversationId, memberUserIds: recipients.userIds }, input);
  },
  readPreviews: async (conversationIds: readonly string[]): Promise<Map<string, DecryptedPreview>> => {
    const found = new Map<string, DecryptedPreview>();
    await Promise.all(conversationIds.map(async (conversationId) => {
      const stored = await getPreviews().get(`preview:${conversationId}`).catch(() => null);
      if (stored !== null) found.set(conversationId, JSON.parse(stored) as DecryptedPreview);
    }));
    return found;
  },
  savePreview: (conversationId: string, preview: DecryptedPreview) => getPreviews().set(`preview:${conversationId}`, JSON.stringify(preview)).catch(() => undefined),
  discardLocalState: async () => {
    client = null;
    previews = null;
    await closeSellerChatCryptoDatabase();
  },
  signOut: async () => {
    await getClient().signOut({ removeFromDirectory: true }).catch(() => undefined);
    client = null;
    previews = null;
    await deleteSellerChatCryptoDatabase();
  },
};
