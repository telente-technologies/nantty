import { sendSellerApiRequest, SellerApiRequestError } from "@/services/clientApi.service";
import type { MediaRecord, MediaUploadSession } from "@/types/productRequests.type";

export const acceptedProductImageMimeTypes = ["image/jpeg", "image/png", "image/webp", "image/avif"];
export const maximumProductImageBytes = 15 * 1024 * 1024;
const maximumAttemptsPerChunk = 4;

async function hashArrayBufferAsHex(buffer: ArrayBuffer): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", buffer);
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

function waitForMilliseconds(milliseconds: number): Promise<void> {
  return new Promise((resolve) => window.setTimeout(resolve, milliseconds));
}

export function describeProductImageProblem(file: File): string | null {
  if (!acceptedProductImageMimeTypes.includes(file.type)) return `${file.name} is not a JPEG, PNG, WebP or AVIF image.`;
  if (file.size > maximumProductImageBytes) return `${file.name} is larger than 15 MB.`;
  if (file.size === 0) return `${file.name} is empty.`;
  return null;
}

async function sendChunkWithRetries(uploadId: string, chunkIndex: number, chunkBuffer: ArrayBuffer, signal?: AbortSignal): Promise<void> {
  const chunkHash = await hashArrayBufferAsHex(chunkBuffer);
  for (let attempt = 1; attempt <= maximumAttemptsPerChunk; attempt += 1) {
    try {
      await sendSellerApiRequest(`/media/uploads/${encodeURIComponent(uploadId)}/chunks/${chunkIndex}`, {
        method: "PUT",
        rawBody: chunkBuffer,
        headers: { "Content-Type": "application/octet-stream", "X-Chunk-Sha256": chunkHash },
        signal,
      });
      return;
    } catch (error) {
      const isRetryable = error instanceof SellerApiRequestError && (error.status === 0 || error.status === 422 || error.status >= 500);
      if (!isRetryable || attempt === maximumAttemptsPerChunk) throw error;
      await waitForMilliseconds(400 * 2 ** attempt);
    }
  }
}

export async function uploadProductImageInChunks(file: File, onProgress: (fraction: number) => void, signal?: AbortSignal): Promise<{ mediaId: string; url: string }> {
  const fileBuffer = await file.arrayBuffer();
  const fileHash = await hashArrayBufferAsHex(fileBuffer);
  const session = await sendSellerApiRequest<MediaUploadSession>("/media/uploads", {
    method: "POST",
    body: { fileName: file.name.slice(0, 200), mimeType: file.type, sizeBytes: file.size, purpose: "product", sha256: fileHash },
    signal,
  });
  const alreadyUploaded = new Set(session.uploadedChunks);
  for (let chunkIndex = 0; chunkIndex < session.totalChunks; chunkIndex += 1) {
    if (!alreadyUploaded.has(chunkIndex)) {
      const chunkStart = chunkIndex * session.chunkSizeBytes;
      await sendChunkWithRetries(session.uploadId, chunkIndex, fileBuffer.slice(chunkStart, chunkStart + session.chunkSizeBytes), signal);
    }
    onProgress((chunkIndex + 1) / (session.totalChunks + 1));
  }
  const completion = await sendSellerApiRequest<{ mediaId: string; status: MediaRecord["status"] }>(`/media/uploads/${encodeURIComponent(session.uploadId)}/complete`, { method: "POST", body: {}, signal });
  for (let poll = 0; poll < 20; poll += 1) {
    const media = await sendSellerApiRequest<MediaRecord>(`/media/${encodeURIComponent(completion.mediaId)}`, { signal });
    if (media.status === "ready" && media.url) {
      onProgress(1);
      return { mediaId: media.mediaId, url: media.url };
    }
    if (media.status === "failed") throw new Error("The image could not be processed. Try a different file.");
    await waitForMilliseconds(1000);
  }
  throw new Error("The image is taking too long to process. Try again in a minute.");
}
