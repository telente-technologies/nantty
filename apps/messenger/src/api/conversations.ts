import { ApiError } from "./apiError";

export interface ConversationSummary {
  readonly id: string;
  readonly peer: {
    readonly id: string;
    readonly name: string;
    readonly username: string;
    readonly avatarUrl: string | null;
    readonly verified: boolean;
  };
  readonly lastMessage: string;
  readonly lastMessageAt: string;
  readonly unread: number;
  readonly kind?: "direct" | "group" | "channel" | "business";
  readonly title?: string | null;
  readonly photoUrl?: string | null;
  readonly store?: { readonly id: string; readonly name: string; readonly avatarUrl?: string | null } | null;
}

export function parseConversationList(payload: unknown): readonly ConversationSummary[] {
  const records = Array.isArray(payload)
    ? payload
    : payload !== null && typeof payload === "object" && Array.isArray((payload as { data?: unknown }).data)
      ? (payload as { data: unknown[] }).data
      : null;

  if (!records) throw new ApiError("Nantty returned an unexpected inbox response. Try again later.", null, "INVALID_INBOX_RESPONSE");

  return records.map((value, index) => {
    if (!isConversationSummary(value)) {
      throw new ApiError(`Nantty returned an invalid conversation at position ${index + 1}.`, null, "INVALID_INBOX_RESPONSE");
    }
    return value;
  });
}

export function conversationDisplayName(conversation: ConversationSummary): string {
  if (conversation.kind === "group" || conversation.kind === "channel") return conversation.title?.trim() || conversation.peer.name;
  if (conversation.kind === "business" || conversation.store) return conversation.store?.name || conversation.peer.name;
  return conversation.peer.name;
}

export function conversationAvatarUrl(conversation: ConversationSummary): string | null {
  if (conversation.photoUrl) return conversation.photoUrl;
  if (conversation.kind === "group" || conversation.kind === "channel") return null;
  if (conversation.kind === "business" || conversation.store) return conversation.store?.avatarUrl ?? conversation.peer.avatarUrl;
  return conversation.peer.avatarUrl;
}

export function formatConversationTime(value: string, now = Date.now()): string {
  const timestamp = Date.parse(value);
  if (!Number.isFinite(timestamp)) return "";
  const age = Math.max(0, now - timestamp);
  if (age < 60_000) return "now";
  if (age < 3_600_000) return `${Math.floor(age / 60_000)}m`;
  if (age < 86_400_000) return new Date(timestamp).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
  return new Date(timestamp).toLocaleDateString([], { month: "short", day: "numeric" });
}

function isConversationSummary(value: unknown): value is ConversationSummary {
  if (value === null || typeof value !== "object") return false;
  const conversation = value as Partial<ConversationSummary>;
  const peer = conversation.peer;
  return typeof conversation.id === "string"
    && typeof conversation.lastMessage === "string"
    && typeof conversation.lastMessageAt === "string"
    && typeof conversation.unread === "number"
    && peer !== null
    && typeof peer === "object"
    && typeof peer.id === "string"
    && typeof peer.name === "string"
    && typeof peer.username === "string";
}
