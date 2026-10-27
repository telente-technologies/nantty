import { ChatCryptoClient, type ChatPayload, type ChatPayloadInput, createHttpKeyDirectory, createWebLocksMutex, describeDecryptionFailure, type EncryptedOutgoingMessage, type GroupAttributes } from "@nantty/chat-crypto";

import type { Conversation, ID, Message, SharedContentKind } from "@/types";

import { sendRequestToWebappServer, WebappRequestError } from "../clientApi.service";
import { createWebChatCryptoStorage, deleteWebChatCryptoDatabase } from "./webKeyStore";

let client: ChatCryptoClient | null = null;

const directory = createHttpKeyDirectory({
  get: (path) => sendRequestToWebappServer(path),
  post: (path, body) => sendRequestToWebappServer(path, { method: "POST", body }),
  put: (path, body) => sendRequestToWebappServer(path, { method: "PUT", body }),
  delete: (path) => sendRequestToWebappServer<void>(path, { method: "DELETE" }),
  isNotFound: (error) => error instanceof WebappRequestError && error.status === 404,
});

const crossTabLock = createWebLocksMutex("nantty-chat-crypto");
const getClient = () => (client ??= new ChatCryptoClient({ storage: createWebChatCryptoStorage(), directory, ...(crossTabLock === undefined ? {} : { lock: crossTabLock }) }));

export interface EncryptionRecipients {
  readonly userIds: readonly ID[];
  readonly storeTeamUserIds: readonly ID[];
}

export const encryptionKindOf = (conversation: Pick<Conversation, "kind">): "direct" | "group" => ((conversation.kind ?? "direct") === "direct" ? "direct" : "group");

const fetchRecipients = (conversationId: ID) => sendRequestToWebappServer<EncryptionRecipients>(`/api/v1/conversations/${conversationId}/recipients`);

export function withDecryptedPayload(message: Message, payload: ChatPayload): Message {
  const shared = payload.sharedContent ?? (payload.storyId ? { kind: "story", id: payload.storyId } : null);
  return {
    ...message,
    text: payload.text,
    linkPreview: payload.linkPreview ?? null,
    attachment: payload.attachment ?? null,
    location: payload.location ?? null,
    poll: payload.poll ?? null,
    control: payload.control ?? null,
    sharedReference: shared && isSharedKind(shared.kind) ? { kind: shared.kind, id: shared.id } : null,
    decryptionNotice: null,
  };
}

const sharedKinds = new Set<string>(["post", "clip", "story", "product", "live", "store", "profile", "order"]);
const isSharedKind = (kind: string): kind is SharedContentKind => sharedKinds.has(kind);

export const chatCryptoService = {
  ensureReady: (viewerId: ID) => getClient().ensureReady(viewerId),
  encryptForConversation: async (conversation: Conversation, viewerId: ID, input: ChatPayloadInput): Promise<EncryptedOutgoingMessage> => {
    await getClient().ensureReady(viewerId);
    const recipients = await fetchRecipients(conversation.id);
    return getClient().encryptMessage({ kind: encryptionKindOf(conversation), conversationId: conversation.id, memberUserIds: recipients.userIds.filter((userId) => userId !== viewerId) }, input);
  },
  encryptForUser: async (userId: ID, viewerId: ID, input: ChatPayloadInput): Promise<EncryptedOutgoingMessage> => {
    await getClient().ensureReady(viewerId);
    return getClient().encryptMessage({ kind: "direct", conversationId: null, memberUserIds: [userId] }, input);
  },
  decryptMessages: async (messages: readonly Message[], viewerId: ID): Promise<Message[]> => {
    void client?.purgeExpiredPlaintext().catch(() => undefined);
    if (!messages.some((message) => message.encryption?.ciphertext)) return messages.map((message) => (typeof message.linkPreview === "string" ? { ...message, linkPreview: null } : message));
    await getClient().ensureReady(viewerId);
    const results = await getClient().decryptMessages(messages);
    return messages.map((message) => {
      const result = results.get(message.id);
      const plainPreview = typeof message.linkPreview === "string" ? null : (message.linkPreview ?? null);
      if (result === undefined || result.status === "unencrypted") return { ...message, linkPreview: plainPreview };
      if (result.status === "failed") return { ...message, text: "", linkPreview: null, decryptionNotice: describeDecryptionFailure(result.reason) };
      return withDecryptedPayload(message, result.payload);
    });
  },
  prepareNewGroup: async (viewerId: ID, attributes: GroupAttributes) => {
    await getClient().ensureReady(viewerId);
    return getClient().prepareNewGroup(attributes);
  },
  rememberGroupKey: (conversationId: ID, groupKey: string) => getClient().rememberGroupKey(conversationId, groupKey),
  sealGroupAttributes: async (viewerId: ID, conversationId: ID, attributes: GroupAttributes, options: { readonly rotate?: boolean } = {}) => {
    await getClient().ensureReady(viewerId);
    return getClient().sealGroupAttributes(conversationId, attributes, options);
  },
  openGroupAttributes: async (viewerId: ID, conversationId: ID, sealed: string | null | undefined): Promise<GroupAttributes | null> => {
    if (!sealed) return null;
    await getClient().ensureReady(viewerId);
    return getClient().openGroupAttributes(conversationId, sealed);
  },
  fetchRecipients,
  purgeExpiredPlaintext: () => client?.purgeExpiredPlaintext() ?? Promise.resolve(0),
  identityChanges: (userIds: readonly ID[]) => getClient().identityChanges(userIds),
  acknowledgeIdentityChange: (userId: ID) => getClient().acknowledgeIdentityChange(userId),
  securityCode: (userId: ID) => getClient().securityCode(userId),
  signOut: async () => {
    await getClient().signOut({ removeFromDirectory: true }).catch(() => undefined);
    client = null;
    await deleteWebChatCryptoDatabase();
  },
};

export const readChatCryptoErrorMessage = (error: unknown): string | null => {
  const code = (error as { code?: string } | null)?.code;
  if (code === "NO_RECIPIENT_DEVICES") return "They haven't set up secure chat yet. Ask them to open Nantty, then try again.";
  if (code === "ENVELOPE_TOO_LARGE") return "This group has too many devices for one encrypted message.";
  if (code === "NOT_REGISTERED") return "Secure chat isn't set up on this device yet. Try again in a moment.";
  return null;
};
