/** Space announcements remain ordinary posts, with one internal room destination. */
export function spaceIdFromAnnouncement(text: string): string | null {
  if (!text.startsWith("Join my Space: ")) return null;
  const match = text.match(
    /\nhttps?:\/\/[^\s/]+\/spaces\/([a-zA-Z0-9_-]+)(?:[?#\s]|$)/,
  );
  return match?.[1] ?? null;
}

/** Keep the route available to link-card parsing while keeping its raw URL out of post copy. */
export function spaceAnnouncementDisplayText(text: string): string {
  return spaceIdFromAnnouncement(text)
    ? text.replace(/\nhttps?:\/\/[^\s/]+\/spaces\/[a-zA-Z0-9_-]+(?:[?#][^\s]*)?\s*$/, "").trimEnd()
    : text;
}
