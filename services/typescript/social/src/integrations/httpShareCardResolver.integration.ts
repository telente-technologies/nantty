import type { ExternalShareCard, ShareCardResolver } from "../interfaces/shareCardResolver.interface.js";

export interface ShareCardSource {
  readonly baseUrl: string;
  readonly internalToken: string;
}

export function createHttpShareCardResolver(sources: { readonly commerce: ShareCardSource | undefined; readonly live: ShareCardSource | undefined }, timeoutMs = 2000): ShareCardResolver {
  return {
    async resolve(kind, id, viewerId) {
      const source = kind === "live" ? sources.live : sources.commerce;
      if (source === undefined || source.baseUrl === "") return null;
      try {
        const url = new URL(`/api/v1/internal/share-cards/${kind}/${encodeURIComponent(id)}?viewerId=${encodeURIComponent(viewerId)}`, source.baseUrl);
        const response = await fetch(url, { headers: { "x-internal-token": source.internalToken }, signal: AbortSignal.timeout(timeoutMs) });
        if (response.status === 404) return { availability: "unavailable", title: null, subtitle: null, imageUrl: null };
        if (!response.ok) return null;
        return (await response.json()) as ExternalShareCard;
      } catch {
        return null;
      }
    },
  };
}
