import type { MediaUploadPurpose } from "@/types";

const MEGABYTE = 1024 * 1024;

export const MAXIMUM_MEDIA_PER_POST = 10;
export const SINGLE_PUT_MAXIMUM_BYTES = 8 * MEGABYTE;
export const MULTIPART_PART_CONCURRENCY = 4;
export const MAXIMUM_CHUNK_URLS_PER_REQUEST = 16;
export const ALLOWED_IMAGE_MIME_TYPES: readonly string[] = ["image/jpeg", "image/png", "image/webp", "image/heic", "image/heif"];
export const ALLOWED_VIDEO_MIME_TYPES: readonly string[] = ["video/mp4", "video/quicktime", "video/webm"];
const MAXIMUM_IMAGE_BYTES = 40 * MEGABYTE;
const MAXIMUM_VIDEO_BYTES_BY_PURPOSE: Partial<Record<MediaUploadPurpose, number>> = { post: 1024 * MEGABYTE, clip: 512 * MEGABYTE, story: 300 * MEGABYTE, chat: 200 * MEGABYTE, product: 300 * MEGABYTE, dispute_evidence: 100 * MEGABYTE };
const MAXIMUM_VIDEO_SECONDS_BY_PURPOSE: Partial<Record<MediaUploadPurpose, number>> = { story: 60, clip: 180, post: 600 };

export class MediaValidationError extends Error {
  public constructor(message: string) {
    super(message);
    this.name = "MediaValidationError";
  }
}

export interface PickedMediaFacts {
  readonly mimeType: string;
  readonly sizeBytes: number;
  readonly durationSeconds: number | null;
}

export function classifyPickedMedia(mimeType: string): "image" | "video" | null {
  const normalised = mimeType.toLowerCase();
  if (ALLOWED_IMAGE_MIME_TYPES.includes(normalised)) return "image";
  if (ALLOWED_VIDEO_MIME_TYPES.includes(normalised)) return "video";
  return null;
}

export function validatePickedMediaBeforeUpload(media: PickedMediaFacts, purpose: MediaUploadPurpose): "image" | "video" {
  const normalised = media.mimeType.toLowerCase();
  if (normalised.startsWith("image/")) {
    if (!ALLOWED_IMAGE_MIME_TYPES.includes(normalised)) throw new MediaValidationError("This photo format isn't supported.");
    if (media.sizeBytes > MAXIMUM_IMAGE_BYTES) throw new MediaValidationError("This photo is too large.");
    return "image";
  }
  if (!ALLOWED_VIDEO_MIME_TYPES.includes(normalised)) throw new MediaValidationError(normalised.startsWith("video/") ? "This video format isn't supported." : "Only photos and videos can be added.");
  const maximumVideoBytes = MAXIMUM_VIDEO_BYTES_BY_PURPOSE[purpose] ?? 0;
  if (maximumVideoBytes === 0) throw new MediaValidationError("Only photos can be used here.");
  if (media.sizeBytes > maximumVideoBytes) throw new MediaValidationError("This video is too large.");
  const maximumSeconds = MAXIMUM_VIDEO_SECONDS_BY_PURPOSE[purpose];
  if (maximumSeconds && (media.durationSeconds ?? 0) > maximumSeconds) throw new MediaValidationError(`Videos can be up to ${Math.round(maximumSeconds / 60)} minutes long.`);
  return "video";
}

export function planUploadChunks(sizeBytes: number, session: { readonly mode?: "single" | "multipart"; readonly partSizeBytes?: number; readonly partCount?: number; readonly chunkSizeBytes: number; readonly totalChunks: number }) {
  const mode = session.mode ?? (sizeBytes < SINGLE_PUT_MAXIMUM_BYTES ? "single" : "multipart");
  if (mode === "single") return { mode, chunkSizeBytes: Math.max(sizeBytes, 1), totalChunks: 1 };
  return { mode, chunkSizeBytes: session.partSizeBytes ?? session.chunkSizeBytes, totalChunks: session.partCount ?? session.totalChunks };
}

export function missingChunkIndexes(totalChunks: number, uploadedChunks: readonly number[]): number[] {
  const uploaded = new Set(uploadedChunks);
  return Array.from({ length: totalChunks }, (_, index) => index).filter((index) => !uploaded.has(index));
}

export const calculateBackoffDelayWithJitter = (attemptNumber: number, baseDelayMs: number, maximumDelayMs: number, random: () => number = Math.random) => {
  const exponentialDelay = Math.min(maximumDelayMs, baseDelayMs * 2 ** attemptNumber);
  return Math.round(exponentialDelay / 2 + random() * (exponentialDelay / 2));
};

export const isRetryableUploadFailure = (error: unknown): boolean => {
  if (error instanceof MediaValidationError) return false;
  if (error instanceof DOMException && error.name === "AbortError") return false;
  const status = (error as { status?: unknown } | null)?.status;
  if (typeof status === "number") return status >= 500 || status === 408 || status === 429 || status === 0;
  return true;
};

export async function runTasksWithBoundedConcurrency<T>(items: readonly T[], concurrencyLimit: number, runTask: (item: T) => Promise<void>): Promise<void> {
  const remainingItems = [...items];
  let firstFailure: { readonly error: unknown } | null = null;
  const runWorker = async () => {
    while (remainingItems.length > 0 && firstFailure === null) {
      const nextItem = remainingItems.shift() as T;
      try {
        await runTask(nextItem);
      } catch (error) {
        firstFailure ??= { error };
      }
    }
  };
  await Promise.all(Array.from({ length: Math.min(concurrencyLimit, items.length) }, runWorker));
  if (firstFailure !== null) throw (firstFailure as { readonly error: unknown }).error;
}
