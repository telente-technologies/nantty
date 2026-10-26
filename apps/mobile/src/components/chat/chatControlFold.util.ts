import { ChatControlLedger, type ControlEntry } from "@nantty/chat-crypto";

import type { LocallyStoredMessage } from "@/cache/messageHistory.type";
import type { SharedLocation } from "@/types";

export interface FoldedConversation {
  readonly visibleMessages: LocallyStoredMessage[];
  readonly groupUpdateCount: number;
}

export const isControlMessage = (message: Pick<LocallyStoredMessage, "kind">) => message.kind === "control";

const controlEntriesOf = (messages: readonly LocallyStoredMessage[]): ControlEntry[] =>
  messages.flatMap((message) =>
    isControlMessage(message) && message.control && message.deliveryStatus !== "failed" ? [{ id: message.id, senderId: message.senderId, createdAt: message.createdAt, control: message.control }] : [],
  );

function foldLiveLocation(ledger: ChatControlLedger, message: LocallyStoredMessage, now: Date): SharedLocation | null | undefined {
  const base = message.location;
  if (message.kind !== "liveLocation" || !base) return base;
  const state = ledger.liveLocation(message.id, message.senderId, { latitude: base.latitude, longitude: base.longitude, label: base.address, liveUntil: base.liveUntil ?? null }, message.createdAt, now);
  return { latitude: state.latitude, longitude: state.longitude, address: state.label, liveUntil: state.stopped ? message.createdAt : state.liveUntil, updatedAt: state.updatedAt ?? message.createdAt };
}

export function foldConversationMessages(messages: readonly LocallyStoredMessage[], viewerId: string, now: Date = new Date()): FoldedConversation {
  const entries = controlEntriesOf(messages);
  const ledger = ChatControlLedger.from(entries);
  const visibleMessages = messages.filter((message) => !isControlMessage(message)).map((message) => {
    const reactions = ledger.reactions(message.id, viewerId).map(({ emoji, count, reactedByMe }) => ({ emoji, count, reactedByMe }));
    const definition = message.pollDefinition;
    return {
      ...message,
      reactions,
      location: foldLiveLocation(ledger, message, now),
      poll: definition ? { question: definition.question, allowMultipleAnswers: definition.allowMultipleAnswers, options: ledger.poll(message.id, definition, viewerId) } : null,
    };
  });
  return { visibleMessages, groupUpdateCount: entries.filter((entry) => entry.control.type === "groupUpdate").length };
}

export function myCurrentVote(messages: readonly LocallyStoredMessage[], pollMessageId: string, viewerId: string): readonly string[] {
  return ChatControlLedger.from(controlEntriesOf(messages)).myVote(pollMessageId, viewerId);
}
