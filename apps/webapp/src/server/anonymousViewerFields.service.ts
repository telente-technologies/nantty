import type { BackendResult } from "./apiTransport.service";

const viewerSpecificFieldNames = new Set(["liked", "bookmarked", "isFollowing", "isFollowingAuthor", "isFollowingHost", "savedByViewer", "reactedByMe", "isSubscribed"]);
const textEncoder = new TextEncoder();
const textDecoder = new TextDecoder();

function resetViewerFieldsDeeply(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(resetViewerFieldsDeeply);
  if (!value || typeof value !== "object") return value;
  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>).map(([key, entry]) => [key, viewerSpecificFieldNames.has(key) && typeof entry === "boolean" ? false : resetViewerFieldsDeeply(entry)]),
  );
}

export function resetViewerFieldsForAnonymousResult(result: BackendResult): BackendResult {
  if (result.status !== 200 || !(result.headers.get("content-type") ?? "").includes("application/json")) return result;
  try {
    const payload = JSON.parse(textDecoder.decode(result.body)) as unknown;
    return { ...result, body: textEncoder.encode(JSON.stringify(resetViewerFieldsDeeply(payload))) };
  } catch {
    return result;
  }
}
