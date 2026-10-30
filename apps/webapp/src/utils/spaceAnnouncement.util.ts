/** Space announcements remain ordinary posts, with one internal room destination. */
export function spaceIdFromAnnouncement(text: string): string | null {
  if (!text.startsWith("Join my Space: ")) return null;
  const match = text.match(
    /\nhttps?:\/\/[^\s/]+\/spaces\/([a-zA-Z0-9_-]+)(?:[?#\s]|$)/,
  );
  return match?.[1] ?? null;
}
