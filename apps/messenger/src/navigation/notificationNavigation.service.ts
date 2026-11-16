type ConversationListener = (conversationId: string) => void;
const listeners = new Set<ConversationListener>();

export function subscribeToConversationOpen(listener: ConversationListener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function requestConversationOpen(conversationId: string): void {
  for (const listener of listeners) listener(conversationId);
}

export function conversationIdFromUrl(url: string): string | null {
  const match = url.match(/\/chats\/([^/?#]+)/i);
  if (!match?.[1]) return null;
  try { return decodeURIComponent(match[1]); } catch { return null; }
}

export function isCompactBubbleUrl(url: string): boolean {
  try { return new URL(url).searchParams.get("surface") === "bubble"; }
  catch { return false; }
}

export function isBubbleTestUrl(url: string): boolean {
  try { return new URL(url).searchParams.get("surface") === "bubble-test"; }
  catch { return false; }
}
