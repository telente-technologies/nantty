import { findUrlsInText, readInternalReferenceFromUrl } from "@/components/chat/chatLinks.util";

export function isSafeFeedPreviewUrl(rawUrl: string): boolean {
  if (rawUrl.length > 2_048) return false;
  try {
    const url = new URL(rawUrl);
    return url.protocol === "https:" && !!url.hostname && !url.username && !url.password;
  } catch {
    return false;
  }
}

export function findFirstSafeExternalFeedUrl(text: string): string | null {
  return findUrlsInText(text).find((url) => isSafeFeedPreviewUrl(url) && !readInternalReferenceFromUrl(url)) ?? null;
}
