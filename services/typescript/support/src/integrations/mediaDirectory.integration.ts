import { SupportError } from "../errors/support.error.js";
import type { MediaDirectory, MediaRecord } from "../interfaces/mediaDirectory.interface.js";

const unavailable = () => new SupportError(503, "MEDIA_UNAVAILABLE", "Attachments can't be checked right now. Try again shortly.");

export function createMediaHttpDirectory(baseUrl: string, internalToken: string, timeoutMs = 3000): MediaDirectory {
  return {
    async findMedia(mediaId): Promise<MediaRecord | null> {
      const response = await fetch(new URL(`/internal/v1/media/${encodeURIComponent(mediaId)}`, baseUrl), {
        headers: { "x-internal-token": internalToken, accept: "application/json" }, signal: AbortSignal.timeout(timeoutMs),
      }).catch(() => null);
      if (response?.status === 404) return null;
      if (response === null || !response.ok) throw unavailable();
      const body = (await response.json()) as Record<string, unknown>;
      const text = (key: string) => (typeof body[key] === "string" ? (body[key] as string) : "");
      return { id: text("id"), ownerId: text("ownerId"), purpose: text("purpose"), kind: text("kind"), status: text("status") };
    },
  };
}
