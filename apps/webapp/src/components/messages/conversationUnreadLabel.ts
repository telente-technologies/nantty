export function conversationUnreadLabel(unread: number): string | null {
  return unread > 0 ? `${unread} unread messages` : null;
}

export function conversationUnreadCount(unread: number): string {
  return unread > 99 ? "99+" : String(unread);
}
