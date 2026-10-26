import { ChatControlLedger, type ChatPayload } from "@nantty/chat-crypto";

import type { Conversation, ConversationMessage, ConversationMessageKind, DecryptedConversationMessage, DecryptedPreview } from "@/types/conversation.type";

const kindLabels: Record<ConversationMessageKind, string> = {
  text: "Message", voice: "Voice note", image: "Photo", video: "Video", system: "Update", shared: "Shared item",
  location: "Location", liveLocation: "Live location", document: "Document", poll: "Poll", control: "Update",
};

export const describeMessageKind = (kind: ConversationMessageKind): string => kindLabels[kind] ?? "Message";

export function withPayload(message: ConversationMessage, payload: ChatPayload): DecryptedConversationMessage {
  const shared = payload.sharedContent ?? (payload.storyId ? { kind: "story", id: payload.storyId } : null);
  return {
    ...message, text: payload.text, attachment: payload.attachment ?? null, location: payload.location ?? null, poll: payload.poll ?? null,
    control: payload.control ?? null, sharedReference: shared, decryptionNotice: null,
  };
}

export function withoutPayload(message: ConversationMessage, notice: string | null): DecryptedConversationMessage {
  return { ...message, text: "", attachment: null, location: null, poll: null, control: null, sharedReference: null, decryptionNotice: notice };
}

export function summariseMessage(message: DecryptedConversationMessage): string {
  if (message.decryptionNotice) return message.decryptionNotice;
  if (message.poll) return `Poll: ${message.poll.question}`;
  if (message.location) return message.location.label ? `Location: ${message.location.label}` : describeMessageKind(message.kind);
  if (message.text.trim() !== "") return message.text;
  if (message.attachment?.fileName) return `${describeMessageKind(message.kind)}: ${message.attachment.fileName}`;
  return describeMessageKind(message.kind);
}

export function foldStoreThread(messages: readonly DecryptedConversationMessage[]): { readonly visible: DecryptedConversationMessage[]; readonly ledger: ChatControlLedger } {
  const ledger = ChatControlLedger.from(messages.flatMap((message) => (message.kind === "control" && message.control && !message.pending ? [{ id: message.id, senderId: message.senderId, createdAt: message.createdAt, control: message.control }] : [])));
  return { visible: messages.filter((message) => message.kind !== "control"), ledger };
}

export function latestPreview(messages: readonly DecryptedConversationMessage[]): DecryptedPreview | null {
  const latest = [...messages].reverse().find((message) => message.kind !== "control" && !message.pending && message.decryptionNotice === null);
  return latest === undefined ? null : { text: summariseMessage(latest).slice(0, 140), createdAt: latest.createdAt };
}

export function previewFor(conversation: Conversation, previews: ReadonlyMap<string, DecryptedPreview>): string {
  if (conversation.lastMessage === null) return "No messages yet";
  const cached = previews.get(conversation.id);
  const body = cached !== undefined && cached.createdAt >= conversation.lastMessage.createdAt ? cached.text : describeMessageKind(conversation.lastMessage.kind);
  return `${conversation.lastMessage.from === "seller" ? "You: " : ""}${body}`;
}

export function filterConversationsLocally(conversations: readonly Conversation[], previews: ReadonlyMap<string, DecryptedPreview>, searchText: string): Conversation[] {
  const needle = searchText.trim().toLowerCase().replace(/^@/, "");
  if (needle === "") return [...conversations];
  return conversations.filter((conversation) =>
    [conversation.customer.name, conversation.customer.username, conversation.orderNumber ?? "", previews.get(conversation.id)?.text ?? ""].some((candidate) => candidate.toLowerCase().includes(needle)));
}

export function describeStoreChatError(error: unknown): string | null {
  const code = (error as { code?: string } | null)?.code;
  if (code === "NO_RECIPIENT_DEVICES") return "This customer hasn't set up secure chat yet. They need to open the Nantty app once before you can reply.";
  if (code === "NOT_STORE_INBOX_MEMBER") return "You no longer have access to this store's messages.";
  if (code === "DEVICE_NOT_REGISTERED" || code === "NOT_REGISTERED") return "Secure chat isn't set up in this browser yet. Reload the page and try again.";
  if (code === "ENVELOPE_TOO_LARGE") return "This store has too many team devices for one encrypted message.";
  if (code === "STORE_TEAM_UNAVAILABLE") return "Secure store chat is temporarily unavailable. Try again shortly.";
  return null;
}

const byTimeThenId = (left: ConversationMessage, right: ConversationMessage) => left.createdAt.localeCompare(right.createdAt) || left.id.localeCompare(right.id);

export function mergeThreadMessages<T extends ConversationMessage>(existing: readonly T[], incoming: readonly T[]): T[] {
  const byId = new Map(existing.map((message) => [message.id, message]));
  for (const message of incoming) byId.set(message.id, message);
  return [...byId.values()].sort(byTimeThenId);
}

export function withoutDeliveredPending<T extends DecryptedConversationMessage>(pending: readonly T[], delivered: readonly ConversationMessage[]): T[] {
  const deliveredKeys = new Set(delivered.flatMap((message) => (message.clientMessageId ? [message.clientMessageId] : [])));
  return pending.filter((message) => message.clientMessageId === null || !deliveredKeys.has(message.clientMessageId));
}

export function isSeenByCustomer(message: DecryptedConversationMessage, customerLastReadAt: string | null | undefined): boolean {
  return message.from === "seller" && !message.pending && typeof customerLastReadAt === "string" && customerLastReadAt >= message.createdAt;
}

export type ChatAttachmentKind = "image" | "video" | "document";
export const maximumChatAttachmentBytes = 100 * 1024 * 1024;

export function chatAttachmentKindOf(file: { readonly type: string }): ChatAttachmentKind {
  if (file.type.startsWith("image/")) return "image";
  if (file.type.startsWith("video/")) return "video";
  return "document";
}
