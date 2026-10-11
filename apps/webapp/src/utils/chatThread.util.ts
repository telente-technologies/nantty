import { ChatControlLedger, type ChatControl, type ControlEntry } from "@zudomart/chat-crypto";

import type { Message } from "@/types";

const byTime = (left: Message, right: Message) => left.createdAt.localeCompare(right.createdAt) || left.id.localeCompare(right.id);

export const isControlMessage = (message: Message) => message.kind === "control";

export function controlEntriesOf(messages: readonly Message[]): ControlEntry[] {
  return messages.flatMap((message) => (isControlMessage(message) && message.control ? [{ id: message.id, senderId: message.senderId, createdAt: message.createdAt, control: message.control as ChatControl }] : []));
}

export function buildChatThread(messages: readonly Message[], viewerId: string, now: Date): { readonly visible: Message[]; readonly ledger: ChatControlLedger } {
  const unique = [...new Map(messages.map((message) => [message.id, message])).values()].sort(byTime);
  const ledger = ChatControlLedger.from(controlEntriesOf(unique));
  const visible = unique
    .filter((message) => !isControlMessage(message))
    .map((message) => {
      const reactions = ledger.reactions(message.id, viewerId).map(({ emoji, count, reactedByMe }) => ({ emoji, count, reactedByMe }));
      const pollTally = message.poll ? ledger.poll(message.id, message.poll, viewerId) : undefined;
      const liveLocation = message.kind === "liveLocation" && message.location ? ledger.liveLocation(message.id, message.senderId, message.location, message.createdAt, now) : null;
      return { ...message, reactions, ...(pollTally ? { pollTally } : {}), liveLocation };
    });
  return { visible, ledger };
}

export function describeMessagePreview(message: Message): string {
  if (message.decryptionNotice) return message.decryptionNotice;
  if (message.text) return message.text;
  if (message.kind === "location") return "📍 Location";
  if (message.kind === "liveLocation") return "📍 Live location";
  if (message.kind === "poll") return message.poll ? `📊 ${message.poll.question}` : "📊 Poll";
  if (message.kind === "voice") return "🎤 Voice note";
  if (message.kind === "image") return "📷 Photo";
  if (message.kind === "video") return "🎬 Video";
  if (message.kind === "document") return `📄 ${message.attachment?.fileName ?? "Document"}`;
  if (message.kind === "shared") return "Shared an item";
  return "Message";
}

export function groupFallbackName(memberNames: readonly string[], viewerName?: string): string {
  const others = memberNames.filter((name) => name && name !== viewerName);
  if (others.length === 0) return "Group";
  if (others.length <= 2) return others.join(" and ");
  return `${others.slice(0, 2).join(", ")} and ${others.length - 2} other${others.length - 2 === 1 ? "" : "s"}`;
}

export function locationMapUrl(latitude: number, longitude: number): string {
  return `https://www.openstreetmap.org/?mlat=${latitude.toFixed(6)}&mlon=${longitude.toFixed(6)}#map=16/${latitude.toFixed(6)}/${longitude.toFixed(6)}`;
}

export const maximumLiveLocationMinutes = 8 * 60;

export function liveUntilFromMinutes(minutes: number, now: Date): string {
  return new Date(now.getTime() + Math.min(Math.max(minutes, 1), maximumLiveLocationMinutes) * 60_000).toISOString();
}

export function validatePollDraft(question: string, options: readonly string[]): string | null {
  const filled = options.map((option) => option.trim()).filter(Boolean);
  if (!question.trim()) return "Ask a question.";
  if (filled.length < 2) return "Add at least 2 options.";
  if (filled.length > 6) return "Polls can have up to 6 options.";
  if (new Set(filled.map((option) => option.toLowerCase())).size !== filled.length) return "Options must be different.";
  return null;
}
