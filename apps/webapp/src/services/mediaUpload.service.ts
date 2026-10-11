import type { CompletedUpload, ID, MediaUploadPurpose, UploadSession } from "@/types";
import {
  calculateBackoffDelayWithJitter, isRetryableUploadFailure, MAXIMUM_CHUNK_URLS_PER_REQUEST, missingChunkIndexes, MULTIPART_PART_CONCURRENCY, planUploadChunks, runTasksWithBoundedConcurrency,
} from "@/utils/mediaUploadRules.util";

import { createIdempotencyKey, readCsrfTokenForRequests, sendRequestToWebappServer, WebappRequestError } from "./clientApi.service";

interface ChunkTarget {
  readonly url: string;
  readonly method: "PUT";
  readonly expectedBytes: number;
  readonly expiresAt: string;
}

const MOCK_OBJECT_STORAGE_ORIGIN = "https://mock-media.s3.amazonaws.com/";
const BFF_MAXIMUM_CHUNK_BYTES = 8 * 1024 * 1024;

export class UploadOfflineError extends Error {
  public constructor() {
    super("You're offline. The upload will continue when you're back online.");
    this.name = "UploadOfflineError";
  }
}

const isBrowserOffline = () => typeof navigator !== "undefined" && navigator.onLine === false;

function waitForMilliseconds(milliseconds: number, signal?: AbortSignal) {
  return new Promise<void>((resolve, reject) => {
    const timer = setTimeout(resolve, milliseconds);
    signal?.addEventListener("abort", () => {
      clearTimeout(timer);
      reject(new DOMException("Upload cancelled", "AbortError"));
    }, { once: true });
  });
}

async function retryUploadStep<T>(operation: () => Promise<T>, signal?: AbortSignal, maximumAttempts = 5): Promise<T> {
  let lastError: unknown;
  for (let attemptNumber = 0; attemptNumber < maximumAttempts; attemptNumber++) {
    signal?.throwIfAborted();
    if (isBrowserOffline()) throw new UploadOfflineError();
    try {
      return await operation();
    } catch (error) {
      lastError = error;
      if (!isRetryableUploadFailure(error) || attemptNumber === maximumAttempts - 1) throw error;
      await waitForMilliseconds(calculateBackoffDelayWithJitter(attemptNumber, 600, 15_000), signal);
    }
  }
  throw lastError;
}

async function putChunkThroughWebappServer(uploadId: ID, chunkIndex: number, bytes: Blob, signal?: AbortSignal) {
  const headers: Record<string, string> = { Accept: "application/json", "Content-Type": "application/octet-stream" };
  const csrfToken = readCsrfTokenForRequests();
  if (csrfToken) headers["X-CSRF-Token"] = csrfToken;
  let response: Response;
  try {
    response = await fetch(`/bff/api/v1/media/uploads/${uploadId}/chunks/${chunkIndex}`, { method: "PUT", headers, body: bytes, credentials: "same-origin", cache: "no-store", signal });
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") throw error;
    throw new WebappRequestError(0, "NETWORK_UNAVAILABLE", "You appear to be offline. Check your connection and try again.");
  }
  if (!response.ok) {
    const errorBody = (await response.json().catch(() => null)) as { readonly code?: string; readonly message?: string } | null;
    throw new WebappRequestError(response.status, errorBody?.code ?? "CHUNK_UPLOAD_FAILED", errorBody?.message ?? "Upload failed");
  }
}

async function putChunk(uploadId: ID, chunkIndex: number, bytes: Blob, target: ChunkTarget, signal?: AbortSignal) {
  if (target.url.startsWith(MOCK_OBJECT_STORAGE_ORIGIN)) {
    await sendRequestToWebappServer(`/api/v1/media/uploads/${uploadId}/chunks/${chunkIndex}`, { method: "PUT", body: { byteLength: bytes.size }, signal });
    return;
  }
  const response = await fetch(target.url, { method: "PUT", body: bytes, signal });
  if (!response.ok) throw new WebappRequestError(response.status, "CHUNK_UPLOAD_FAILED", "Upload failed");
}

export interface UploadProgress {
  readonly uploadedBytes: number;
  readonly totalBytes: number;
}

export const mediaUploadService = {
  createUploadSession: (file: File, purpose: MediaUploadPurpose, signal?: AbortSignal) =>
    sendRequestToWebappServer<UploadSession>("/api/v1/media/uploads", {
      method: "POST",
      body: { fileName: file.name || "upload", mimeType: file.type, sizeBytes: file.size, purpose },
      idempotencyKey: createIdempotencyKey("upload"),
      signal,
    }),
  fetchChunkTargets: (uploadId: ID, chunkIndexes: readonly number[], signal?: AbortSignal) =>
    sendRequestToWebappServer<{ readonly urls: readonly (ChunkTarget & { readonly chunkIndex: number })[] }>(`/api/v1/media/uploads/${uploadId}/chunks/urls`, { method: "POST", body: { chunkIndexes }, signal }),
  fetchChunkTarget: (uploadId: ID, chunkIndex: number, signal?: AbortSignal) =>
    sendRequestToWebappServer<ChunkTarget>(`/api/v1/media/uploads/${uploadId}/chunks/${chunkIndex}/url`, { signal }),
  completeUploadSession: (uploadId: ID, signal?: AbortSignal) => sendRequestToWebappServer<CompletedUpload>(`/api/v1/media/uploads/${uploadId}/complete`, { method: "POST", signal }),
  abortUploadSession: (uploadId: ID) => sendRequestToWebappServer<void>(`/api/v1/media/uploads/${uploadId}`, { method: "DELETE" }),

  uploadFile: async (file: File, purpose: MediaUploadPurpose, onProgress: (progress: UploadProgress) => void, signal?: AbortSignal): Promise<{ readonly mediaId: ID; readonly uploadId: ID }> => {
    const session = await retryUploadStep(() => mediaUploadService.createUploadSession(file, purpose, signal), signal);
    const plan = planUploadChunks(file.size, session);
    const pending = missingChunkIndexes(plan.totalChunks, session.uploadedChunks);
    const bytesDone = new Map<number, number>();
    const report = () => onProgress({ uploadedBytes: [...bytesDone.values()].reduce((sum, value) => sum + value, 0), totalBytes: file.size });
    report();
    const prefetched = new Map<number, ChunkTarget>();
    if (pending.length > 1 && plan.chunkSizeBytes > BFF_MAXIMUM_CHUNK_BYTES) {
      const batch = await mediaUploadService.fetchChunkTargets(session.uploadId, pending.slice(0, MAXIMUM_CHUNK_URLS_PER_REQUEST), signal).catch(() => null);
      batch?.urls.forEach(({ chunkIndex, ...target }) => prefetched.set(chunkIndex, target));
    }
    try {
      await runTasksWithBoundedConcurrency(pending, plan.mode === "single" ? 1 : MULTIPART_PART_CONCURRENCY, async (chunkIndex) => {
        const start = chunkIndex * plan.chunkSizeBytes;
        const bytes = file.slice(start, Math.min(file.size, start + plan.chunkSizeBytes));
        let target = prefetched.get(chunkIndex);
        await retryUploadStep(async () => {
          if (bytes.size <= BFF_MAXIMUM_CHUNK_BYTES) return putChunkThroughWebappServer(session.uploadId, chunkIndex, bytes, signal);
          try {
            target ??= await mediaUploadService.fetchChunkTarget(session.uploadId, chunkIndex, signal);
            await putChunk(session.uploadId, chunkIndex, bytes, target, signal);
          } catch (error) {
            target = undefined;
            throw error;
          }
        }, signal);
        bytesDone.set(chunkIndex, bytes.size);
        report();
      });
      const completed = await retryUploadStep(() => mediaUploadService.completeUploadSession(session.uploadId, signal), signal);
      return { mediaId: completed.mediaId, uploadId: session.uploadId };
    } catch (error) {
      if (signal?.aborted) void mediaUploadService.abortUploadSession(session.uploadId).catch(() => undefined);
      throw error;
    }
  },
};
