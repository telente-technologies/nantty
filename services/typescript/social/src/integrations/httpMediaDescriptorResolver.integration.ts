import type { MediaDescriptorResolver } from "../interfaces/mediaDescriptorResolver.interface.js";
import type { MediaReferenceInput } from "../modules/posts/commands/createPost/createPost.command.js";

interface InternalMediaResponse {
  readonly ownerId: string;
  readonly kind: string;
  readonly status: string;
  readonly displayUrl: string | null;
  readonly asset: {
    readonly width: number;
    readonly height: number;
    readonly durationSeconds?: number;
    readonly blurhash?: string;
    readonly posterUrl?: string;
    readonly hlsUrl?: string;
    readonly variants: ReadonlyArray<{ readonly url: string }>;
  };
}

const usableStatuses = new Set(["uploaded", "processing", "ready", "held"]);

function convertToMediaReference(mediaId: string, media: InternalMediaResponse): MediaReferenceInput | undefined {
  if ((media.kind !== "image" && media.kind !== "video") || !usableStatuses.has(media.status)) return undefined;
  const ready = media.status === "ready";
  return {
    id: mediaId,
    type: media.kind,
    url: ready ? (media.displayUrl ?? media.asset.variants[0]?.url ?? null) : null,
    posterUrl: ready ? (media.asset.posterUrl ?? null) : null,
    hlsUrl: ready ? (media.asset.hlsUrl ?? null) : null,
    ...(media.asset.width > 0 ? { width: media.asset.width } : {}),
    ...(media.asset.height > 0 ? { height: media.asset.height } : {}),
    ...(media.asset.durationSeconds === undefined ? {} : { durationSeconds: media.asset.durationSeconds }),
    blurhash: media.asset.blurhash ?? null,
  };
}

export function createHttpMediaDescriptorResolver(source: { readonly baseUrl: string; readonly internalToken: string }, timeoutMs = 2000): MediaDescriptorResolver {
  async function fetchMedia(mediaId: string): Promise<InternalMediaResponse | undefined> {
    const response = await fetch(new URL(`/internal/v1/media/${encodeURIComponent(mediaId)}`, source.baseUrl), { headers: { "x-internal-token": source.internalToken }, signal: AbortSignal.timeout(timeoutMs) });
    if (response.status === 404) return undefined;
    if (!response.ok) throw new Error(`media responded ${response.status}`);
    return (await response.json()) as InternalMediaResponse;
  }
  return {
    async resolveOwnedMedia(ownerId, mediaIds) {
      const resolved = new Map<string, MediaReferenceInput>();
      const found = await Promise.all([...new Set(mediaIds)].map(async (mediaId) => [mediaId, await fetchMedia(mediaId)] as const));
      for (const [mediaId, media] of found) {
        const reference = media === undefined || media.ownerId !== ownerId ? undefined : convertToMediaReference(mediaId, media);
        if (reference !== undefined) resolved.set(mediaId, reference);
      }
      return resolved;
    },
  };
}
