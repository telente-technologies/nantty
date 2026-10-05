import { SocialError } from "../errors/social.error.js";
import type { ChatMediaAccess, ChatMediaDescriptor } from "../interfaces/chatMediaAccess.interface.js";

interface InternalMediaResponse {
  readonly id: string;
  readonly ownerId: string;
  readonly purpose: string;
  readonly kind: string;
  readonly status: string;
  readonly sizeBytes: number;
  readonly asset?: { readonly durationSeconds?: number };
}

export function createHttpChatMediaAccess(source: { readonly baseUrl: string; readonly internalToken: string }, timeoutMs = 2000): ChatMediaAccess {
  const headers = { "x-internal-token": source.internalToken, "content-type": "application/json" };
  return {
    async describe(mediaId) {
      const response = await fetch(new URL(`/internal/v1/media/${encodeURIComponent(mediaId)}`, source.baseUrl), { headers, signal: AbortSignal.timeout(timeoutMs) }).catch(() => null);
      if (response?.status === 404) return undefined;
      if (response === null || !response.ok) throw new SocialError(503, "MEDIA_UNAVAILABLE", "Media is temporarily unavailable. Try again shortly.");
      const media = (await response.json()) as InternalMediaResponse;
      const descriptor: ChatMediaDescriptor = { id: media.id, ownerId: media.ownerId, purpose: media.purpose, kind: media.kind, status: media.status, sizeBytes: media.sizeBytes };
      return media.asset?.durationSeconds === undefined ? descriptor : { ...descriptor, durationSeconds: media.asset.durationSeconds };
    },
    async signForParticipant(mediaId, viewerId) {
      const response = await fetch(new URL(`/internal/v1/media/${encodeURIComponent(mediaId)}/signed-url`, source.baseUrl), {
        method: "POST", headers, body: JSON.stringify({ actorId: viewerId, reason: "chat participant playback" }), signal: AbortSignal.timeout(timeoutMs),
      }).catch(() => null);
      if (response === null || !response.ok) return null;
      return ((await response.json()) as { readonly url?: string }).url ?? null;
    },
  };
}
