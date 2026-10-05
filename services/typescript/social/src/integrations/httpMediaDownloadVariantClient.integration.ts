import { SocialError } from "../errors/social.error.js";
import type { MediaDownloadVariant, MediaDownloadVariantClient } from "../interfaces/mediaDownloadVariant.interface.js";

export function createHttpMediaDownloadVariantClient(source: { readonly baseUrl: string; readonly internalToken: string }, timeoutMs = 20_000): MediaDownloadVariantClient {
  return {
    async requestDownloadVariant({ mediaId, ...body }) {
      const response = await fetch(new URL(`/internal/v1/media/${encodeURIComponent(mediaId)}/download-variant`, source.baseUrl), {
        method: "POST",
        headers: { "x-internal-token": source.internalToken, "content-type": "application/json" },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(timeoutMs),
      });
      if (response.ok) return (await response.json()) as MediaDownloadVariant;
      const failure = (await response.json().catch(() => null)) as { readonly code?: string; readonly message?: string } | null;
      if (response.status === 404 || response.status === 409 || response.status === 422) throw new SocialError(response.status, failure?.code ?? "DOWNLOAD_UNAVAILABLE", failure?.message ?? "This download isn't available.");
      throw new SocialError(503, "DOWNLOADS_UNAVAILABLE", "Downloads are temporarily unavailable. Try again shortly.");
    },
  };
}
