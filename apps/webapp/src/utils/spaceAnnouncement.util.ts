export function spaceIdFromAnnouncement(text: string): string | null {
  if (!text.startsWith("Join my Space: ")) return null;
  return text.match(/\nhttps?:\/\/[^\s/]+\/spaces\/([a-zA-Z0-9_-]+)(?:[?#\s]|$)/)?.[1] ?? null;
}

export function spaceAnnouncementDisplayText(text: string): string {
  return spaceIdFromAnnouncement(text)
    ? text.replace(/\nhttps?:\/\/[^\s/]+\/spaces\/[a-zA-Z0-9_-]+(?:[?#][^\s]*)?\s*$/, "").trimEnd()
    : text;
}
