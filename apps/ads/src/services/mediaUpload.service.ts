import { sendAdsApiRequest, buildAccountApiPath, AdsApiRequestError } from "@/services/adsApiClient.service";
import { calculateSha256HexOfBytes } from "@/services/sha256Hashing.service";
import type { UploadedMedia, UploadSession } from "@/types/creative.type";

export const acceptedCreativeMimeTypes = ["image/jpeg", "image/png", "image/webp", "image/avif", "video/mp4", "video/quicktime"];
export const maximumCreativeFileBytes = 500 * 1024 * 1024;

export function describeWhyCreativeFileIsNotAccepted(file: File): string | null {
  if (!acceptedCreativeMimeTypes.includes(file.type)) return "Use a JPG, PNG, WebP or AVIF image, or an MP4 or MOV video.";
  if (file.size > maximumCreativeFileBytes) return "Files can be at most 500 MB.";
  if (file.size === 0) return "That file is empty.";
  return null;
}

async function sendChunkWithOneRetry(uploadId: string, chunkIndex: number, chunkBytes: Uint8Array, chunkSha256: string): Promise<void> {
  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      await sendAdsApiRequest(`/media/uploads/${encodeURIComponent(uploadId)}/chunks/${chunkIndex}`, {
        method: "PUT",
        rawBody: chunkBytes as Uint8Array<ArrayBuffer>,
        headers: { "Content-Type": "application/octet-stream", "X-Chunk-Sha256": chunkSha256 },
      });
      return;
    } catch (error) {
      if (attempt === 1 || (error instanceof AdsApiRequestError && error.status >= 400 && error.status < 500)) throw error;
    }
  }
}

export async function uploadCreativeFileInChunks(accountId: string, file: File, onProgress: (fractionComplete: number) => void): Promise<UploadedMedia> {
  const session = await sendAdsApiRequest<UploadSession>("/media/uploads", {
    method: "POST",
    body: { fileName: file.name.slice(0, 200), mimeType: file.type, sizeBytes: file.size, purpose: "ad_creative", adAccountId: accountId },
  });
  const alreadyUploaded = new Set(session.uploadedChunks);
  for (let chunkIndex = 0; chunkIndex < session.totalChunks; chunkIndex += 1) {
    if (!alreadyUploaded.has(chunkIndex)) {
      const chunkStart = chunkIndex * session.chunkSizeBytes;
      const chunkBytes = new Uint8Array(await file.slice(chunkStart, chunkStart + session.chunkSizeBytes).arrayBuffer());
      await sendChunkWithOneRetry(session.uploadId, chunkIndex, chunkBytes, await calculateSha256HexOfBytes(chunkBytes));
    }
    onProgress((chunkIndex + 1) / session.totalChunks);
  }
  const completed = await sendAdsApiRequest<{ mediaId: string }>(`/media/uploads/${encodeURIComponent(session.uploadId)}/complete`, { method: "POST" });
  for (let attempt = 0; attempt < 20; attempt += 1) {
    const media = await sendAdsApiRequest<UploadedMedia>(buildAccountApiPath(accountId, `/creatives/media/${encodeURIComponent(completed.mediaId)}`));
    if (media.status !== "processing") return media;
    await new Promise((resolve) => setTimeout(resolve, 1500));
  }
  return { mediaId: completed.mediaId, status: "processing", media: null };
}
