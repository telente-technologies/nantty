import { ChatCryptoError } from "./errors";
import type { ChatPayload } from "./payload";

interface ServerBoundMessage {
  readonly conversationId: string;
  readonly sharedContent?: unknown;
}

function readServerReference(sharedContent: unknown): { readonly kind: string; readonly id: string } | null {
  if (sharedContent === null || typeof sharedContent !== "object") return null;
  const record = sharedContent as { readonly reference?: { readonly kind?: unknown; readonly id?: unknown }; readonly kind?: unknown; readonly id?: unknown };
  const source = record.reference ?? record;
  return typeof source.kind === "string" && typeof source.id === "string" ? { kind: source.kind, id: source.id } : null;
}

export function assertPayloadMatchesServer(payload: ChatPayload, message: ServerBoundMessage): void {
  if (payload.conversationId !== undefined && payload.conversationId !== message.conversationId) throw new ChatCryptoError("PAYLOAD_MISMATCH", "The message belongs to another conversation.");
  const reference = readServerReference(message.sharedContent);
  if (payload.storyId !== undefined && reference !== null && (reference.kind !== "story" || reference.id !== payload.storyId)) throw new ChatCryptoError("PAYLOAD_MISMATCH", "The story this reply is bound to does not match.");
  if (payload.sharedContent && reference !== null && (reference.kind !== payload.sharedContent.kind || reference.id !== payload.sharedContent.id)) {
    throw new ChatCryptoError("PAYLOAD_MISMATCH", "The shared item does not match the encrypted message.");
  }
}
