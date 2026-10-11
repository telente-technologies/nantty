import type { Message } from "@/types";

export const localMessageIdOf = (key: string) => `local:${key}`;
export const isLocalMessage = (message: Pick<Message, "id">) => message.id.startsWith("local:");

export function buildPendingMessage(key: string, conversationId: string, senderId: string, draft: Partial<Message>, now: Date): Message {
  return { text: "", ...draft, id: localMessageIdOf(key), conversationId, senderId, createdAt: now.toISOString(), clientMessageId: key, deliveryState: "pending" };
}

export const rollsBackOnFailure = (message: Pick<Message, "kind">) => message.kind === "control";

export function mergeOptimisticMessages(server: readonly Message[], pending: readonly Message[]): Message[] {
  const confirmedKeys = new Set(server.flatMap((message) => (message.clientMessageId ? [message.clientMessageId] : [])));
  return [...server, ...pending.filter((message) => !message.clientMessageId || !confirmedKeys.has(message.clientMessageId))];
}

export function insertConfirmedMessage(pages: readonly { readonly data: readonly Message[] }[], message: Message): { readonly data: readonly Message[] }[] {
  if (pages.some((page) => page.data.some((existing) => existing.id === message.id))) return [...pages];
  const [first, ...rest] = pages;
  return [{ ...(first ?? { data: [] }), data: [...(first?.data ?? []), message] }, ...rest];
}
