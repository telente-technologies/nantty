import { sendRequestToDashboardServer, sendSellerApiRequest, SellerApiRequestError } from "@/services/clientApi.service";
import type { MediaChunkUploadTarget, MediaRecord, MediaUploadSession } from "@/types/productRequests.type";

export const acceptedProductImageMimeTypes = ["image/jpeg", "image/png", "image/webp", "image/avif"];
export const maximumProductImageBytes = 10 * 1024 * 1024;
const maximumAttemptsPerChunk = 4;
const maximumChunkUrlsPerRequest = 16;

export async function hashArrayBufferAsHex(buffer: ArrayBuffer): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", buffer);
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

function waitForMilliseconds(milliseconds: number): Promise<void> {
  return new Promise((resolve) => window.setTimeout(resolve, milliseconds));
}

export function describeProductImageProblem(file: File): string | null {
  if (!acceptedProductImageMimeTypes.includes(file.type)) return `${file.name} is not a JPEG, PNG, WebP or AVIF image.`;
  if (file.size > maximumProductImageBytes) return `${file.name} is larger than 10 MB.`;
  if (file.size === 0) return `${file.name} is empty.`;
  return null;
}

export async function sendBytesToUploadTarget(url: string, bytes: BodyInit, headers: Record<string, string>, signal?: AbortSignal): Promise<void> {
  if (url.startsWith("/")) {
    await sendRequestToDashboardServer(url, { method: "PUT", rawBody: bytes, headers, signal });
    return;
  }
  let response: Response;
  try {
    response = await fetch(url, { method: "PUT", headers, body: bytes, credentials: "omit", signal });
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") throw error;
    throw new SellerApiRequestError(0, "NETWORK_UNAVAILABLE", "The upload was interrupted. Check your connection and try again.");
  }
  if (!response.ok) throw new SellerApiRequestError(response.status >= 500 ? response.status : 400, "UPLOAD_FAILED", "The image could not be uploaded. Try again.");
}

export async function retryChunk(send: () => Promise<void>): Promise<void> {
  for (let attempt = 1; attempt <= maximumAttemptsPerChunk; attempt += 1) {
    try {
      await send();
      return;
    } catch (error) {
      const isRetryable = error instanceof SellerApiRequestError && (error.status === 0 || error.status === 422 || error.status >= 500);
      if (!isRetryable || attempt === maximumAttemptsPerChunk) throw error;
      await waitForMilliseconds(400 * 2 ** attempt);
    }
  }
}

async function sendProxiedChunk(uploadId: string, chunkIndex: number, chunkBuffer: ArrayBuffer, signal?: AbortSignal): Promise<void> {
  const chunkHash = await hashArrayBufferAsHex(chunkBuffer);
  await retryChunk(() =>
    sendSellerApiRequest(`/media/uploads/${encodeURIComponent(uploadId)}/chunks/${chunkIndex}`, {
      method: "PUT",
      rawBody: chunkBuffer,
      headers: { "Content-Type": "application/octet-stream", "X-Chunk-Sha256": chunkHash },
      signal,
    }),
  );
}

export async function sendMultipartChunks(session: MediaUploadSession, fileBuffer: ArrayBuffer, onProgress: (fraction: number) => void, signal?: AbortSignal): Promise<void> {
  const pendingChunkIndexes = Array.from({ length: session.totalChunks }, (_, index) => index).filter((index) => !session.uploadedChunks.includes(index));
  const readChunk = (chunkIndex: number) => fileBuffer.slice(chunkIndex * session.chunkSizeBytes, (chunkIndex + 1) * session.chunkSizeBytes);
  let sentCount = session.totalChunks - pendingChunkIndexes.length;
  for (let batchStart = 0; batchStart < pendingChunkIndexes.length; batchStart += maximumChunkUrlsPerRequest) {
    const batch = pendingChunkIndexes.slice(batchStart, batchStart + maximumChunkUrlsPerRequest);
    const targets = session.uploadMode === "proxied"
      ? null
      : (await sendSellerApiRequest<{ urls: MediaChunkUploadTarget[] }>(`/media/uploads/${encodeURIComponent(session.uploadId)}/chunks/urls`, { method: "POST", body: { chunkIndexes: batch }, signal })).urls;
    for (const chunkIndex of batch) {
      const target = targets?.find((candidate) => candidate.chunkIndex === chunkIndex);
      if (target) await retryChunk(() => sendBytesToUploadTarget(target.url, readChunk(chunkIndex), {}, signal));
      else await sendProxiedChunk(session.uploadId, chunkIndex, readChunk(chunkIndex), signal);
      sentCount += 1;
      onProgress(sentCount / (session.totalChunks + 1));
    }
  }
}

function pickLargestVariantUrl(media: MediaRecord): string | null {
  const largest = [...media.variants].sort((first, second) => second.width - first.width)[0];
  return largest?.url ?? null;
}

export async function uploadProductImageInChunks(file: File, onProgress: (fraction: number) => void, signal?: AbortSignal): Promise<{ mediaId: string; url: string }> {
  const fileBuffer = await file.arrayBuffer();
  const fileHash = await hashArrayBufferAsHex(fileBuffer);
  const session = await sendSellerApiRequest<MediaUploadSession>("/media/uploads", {
    method: "POST",
    body: { fileName: file.name.slice(0, 200), mimeType: file.type, sizeBytes: file.size, purpose: "product", sha256: fileHash },
    signal,
  });
  if (session.mode === "single" && session.url) {
    await retryChunk(() => sendBytesToUploadTarget(session.url as string, fileBuffer, session.headers ?? { "Content-Type": file.type }, signal));
    onProgress(1 / 2);
  } else {
    await sendMultipartChunks(session, fileBuffer, onProgress, signal);
  }
  const completion = await sendSellerApiRequest<{ mediaId: string; status: MediaRecord["status"] }>(`/media/uploads/${encodeURIComponent(session.uploadId)}/complete`, { method: "POST", signal });
  for (let poll = 0; poll < 20; poll += 1) {
    const media = await sendSellerApiRequest<MediaRecord>(`/media/${encodeURIComponent(completion.mediaId)}`, { signal });
    const url = media.status === "ready" ? pickLargestVariantUrl(media) : null;
    if (url) {
      onProgress(1);
      return { mediaId: media.id, url };
    }
    if (media.status === "failed") throw new Error(media.failureHint ?? "The image could not be processed. Try a different file.");
    await waitForMilliseconds(1000);
  }
  throw new Error("The image is taking too long to process. Try again in a minute.");
}
