import { ChatCryptoClient, type ChatPayloadInput, createHttpKeyDirectory, describeDecryptionFailure, type EncryptedOutgoingMessage } from "@zudomart/chat-crypto";

import type { Conversation, ID, Message } from "@/types";

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

const getClient = () => (client ??= new ChatCryptoClient({ storage: createWebChatCryptoStorage(), directory }));

async function memberUserIdsOf(conversation: Conversation): Promise<ID[]> {
  if ((conversation.kind ?? "direct") !== "group") return [conversation.peer.id];
  const members = await sendRequestToWebappServer<readonly { readonly user: { readonly id: ID } }[] | { readonly data: readonly { readonly user: { readonly id: ID } }[] }>(`/api/v1/conversations/${conversation.id}/members`);
  return (Array.isArray(members) ? members : (members as { data: readonly { user: { id: ID } }[] }).data).map((member) => member.user.id);
}

export const chatCryptoService = {
  ensureReady: (viewerId: ID) => getClient().ensureReady(viewerId),
  encryptForConversation: async (conversation: Conversation, viewerId: ID, input: ChatPayloadInput): Promise<EncryptedOutgoingMessage> => {
    await getClient().ensureReady(viewerId);
    const kind = (conversation.kind ?? "direct") === "group" ? "group" : "direct";
    return getClient().encryptMessage({ kind, conversationId: conversation.id, memberUserIds: await memberUserIdsOf(conversation) }, input);
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
      return { ...message, text: result.payload.text, linkPreview: result.payload.linkPreview ?? null, attachment: result.payload.attachment ?? null, decryptionNotice: null };
    });
  },
  purgeExpiredPlaintext: () => client?.purgeExpiredPlaintext() ?? Promise.resolve(0),
  identityChanges: (userIds: readonly ID[]) => getClient().identityChanges(userIds),
  acknowledgeIdentityChange: (userId: ID) => getClient().acknowledgeIdentityChange(userId),
  securityCode: (userId: ID) => getClient().securityCode(userId),
  signOut: async () => {
    await client?.signOut({ removeFromDirectory: true }).catch(() => undefined);
    client = null;
    await deleteWebChatCryptoDatabase();
  },
};

export const readChatCryptoErrorMessage = (error: unknown): string | null => {
  const code = (error as { code?: string } | null)?.code;
  if (code === "NO_RECIPIENT_DEVICES") return "They haven't set up secure chat yet. Ask them to open Zudomart, then try again.";
  if (code === "ENVELOPE_TOO_LARGE") return "This group has too many devices for one encrypted message.";
  if (code === "NOT_REGISTERED") return "Secure chat isn't set up on this device yet. Try again in a moment.";
  return null;
};
