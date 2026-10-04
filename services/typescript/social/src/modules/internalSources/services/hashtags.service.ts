const hashtagPattern = /#([\p{L}\p{N}_]{2,50})/gu;

export function extractHashtags(text: string): string[] {
  return [...new Set([...text.matchAll(hashtagPattern)].map((match) => (match[1] ?? "").toLowerCase()).filter((tag) => tag !== ""))].slice(0, 30);
}
