import type { ChatReportEvidenceMessage, Message } from "@/types";

export const listReportableMessages = (messages: readonly Message[]) => messages.filter((message) => message.kind !== "system" && !message.decryptionNotice);

export const buildEvidenceMessage = (message: Message, viewerId: string, senderNameById: ReadonlyMap<string, string>): ChatReportEvidenceMessage => ({
  messageId: message.id,
  senderId: message.senderId,
  senderName: message.senderId === viewerId ? "You" : (senderNameById.get(message.senderId) ?? message.sender?.name ?? "Unknown"),
  sentAt: message.createdAt,
  text: message.text,
  attachments: message.media
    ? [{ type: message.media.type, mimeType: null, fileName: null, sizeBytes: null, durationSeconds: message.media.durationSeconds ?? null }]
    : [],
});

export async function hashEvidenceForIntegrity(evidence: readonly ChatReportEvidenceMessage[]): Promise<string> {
  const bytes = new TextEncoder().encode(JSON.stringify(evidence));
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}
