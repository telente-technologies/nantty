import type { PostMediaCleaner } from "../interfaces/postMediaCleaner.interface.js";

export function createHttpPostMediaCleaner(source: { readonly baseUrl: string; readonly internalToken: string }, timeoutMs = 5000): PostMediaCleaner {
  return {
    async deleteMedia(mediaIds, reason) {
      if (mediaIds.length === 0) return;
      const response = await fetch(new URL("/internal/v1/media/delete", source.baseUrl), {
        method: "POST",
        headers: { "x-internal-token": source.internalToken, "content-type": "application/json" },
        body: JSON.stringify({ mediaIds: [...new Set(mediaIds)].slice(0, 500), reason }),
        signal: AbortSignal.timeout(timeoutMs),
      });
      if (!response.ok) throw new Error(`media delete failed with status ${response.status}`);
    },
  };
}
