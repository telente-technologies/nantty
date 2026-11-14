export interface BubbleSelection {
  readonly enabled: boolean;
  readonly mode: "all" | "selected";
  readonly conversationIds: readonly string[];
  readonly excludedConversationIds: readonly string[];
}

export function conversationBubbleDraftKey(accountId: string, conversationId: string): string {
  return `bubbleDraft:${encodeURIComponent(accountId)}:${encodeURIComponent(conversationId)}`;
}

export function toggleInAppConversation(conversationIds: readonly string[], conversationId: string): string[] {
  return conversationIds.includes(conversationId)
    ? conversationIds.filter((id) => id !== conversationId)
    : [...conversationIds, conversationId];
}

export function updateConversationDraft(drafts: Readonly<Record<string, string>>, conversationId: string, text: string): Record<string, string> {
  if (text.length === 0) {
    const next = { ...drafts };
    delete next[conversationId];
    return next;
  }
  return { ...drafts, [conversationId]: text };
}

export function isConversationBubbleEnabled(preferences: BubbleSelection, conversationId: string): boolean {
  return preferences.enabled
    && !preferences.excludedConversationIds.includes(conversationId)
    && (preferences.mode === "all" || preferences.conversationIds.includes(conversationId));
}

export function toggleConversationBubble<T extends BubbleSelection>(preferences: T, conversationId: string): T {
  const enabled = isConversationBubbleEnabled(preferences, conversationId);
  if (preferences.mode === "all") {
    const excludedConversationIds = new Set(preferences.excludedConversationIds);
    enabled ? excludedConversationIds.add(conversationId) : excludedConversationIds.delete(conversationId);
    return { ...preferences, excludedConversationIds: [...excludedConversationIds] };
  }
  const conversationIds = new Set(preferences.conversationIds);
  enabled ? conversationIds.delete(conversationId) : conversationIds.add(conversationId);
  return { ...preferences, conversationIds: [...conversationIds] };
}
