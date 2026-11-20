import { AdsApiRequestError, buildAccountApiPath, readCsrfTokenForRequests, sendAdsApiRequest } from "@/services/adsApiClient.service";
import type { MediaUploadIntent, UploadedMedia } from "@/types/creative.type";

export const acceptedCreativeMimeTypes = ["image/jpeg", "image/png", "image/webp", "image/avif", "video/mp4", "video/quicktime"];
export const maximumCreativeFileBytes = 500 * 1024 * 1024;

export function describeWhyCreativeFileIsNotAccepted(file: File): string | null {
  if (!acceptedCreativeMimeTypes.includes(file.type)) return "Use a JPG, PNG, WebP or AVIF image, or an MP4 or MOV video.";
  if (file.size > maximumCreativeFileBytes) return "Files can be at most 500 MB.";
  if (file.size === 0) return "That file is empty.";
  return null;
}

export interface BrowserMediaMetadata {
  readonly width: number;
  readonly height: number;
  readonly durationSeconds: number | null;
}

export async function readMediaMetadataInBrowser(file: File): Promise<BrowserMediaMetadata | null> {
  if (file.type.startsWith("image/")) {
    try {
      const bitmap = await createImageBitmap(file);
      const metadata = { width: bitmap.width, height: bitmap.height, durationSeconds: null };
      bitmap.close();
      return metadata;
    } catch {
      return null;
    }
  }
  if (!file.type.startsWith("video/")) return null;
  const objectUrl = URL.createObjectURL(file);
  try {
    const parsedUrl = new URL(objectUrl);
    if (parsedUrl.protocol !== "blob:") return null;
    const safeBlobUrl = parsedUrl.href;
    return await new Promise<BrowserMediaMetadata | null>((resolve) => {
      const video = document.createElement("video");
      video.preload = "metadata";
      video.onloadedmetadata = () => resolve({ width: video.videoWidth, height: video.videoHeight, durationSeconds: Number.isFinite(video.duration) ? Math.round(video.duration * 10) / 10 : null });
      video.onerror = () => resolve(null);
      video.src = safeBlobUrl;
    });
  } catch {
    return null;
  } finally {
    setTimeout(() => URL.revokeObjectURL(objectUrl), 1000);
  }
}

const headersTheBrowserSetsItself = new Set(["host", "content-length"]);

function isUploadUrlUsable(uploadUrl: string): boolean {
  if (uploadUrl.startsWith("/") && !uploadUrl.startsWith("//")) return true;
  try {
    const { protocol } = new URL(uploadUrl);
    return protocol === "https:" || protocol === "http:";
  } catch {
    return false;
  }
}

function sendFileToUploadUrl(intent: MediaUploadIntent, file: File, onProgress: (fractionComplete: number) => void): Promise<void> {
  if (!isUploadUrlUsable(intent.uploadUrl)) return Promise.reject(new AdsApiRequestError(503, "STORAGE_UNAVAILABLE", "Uploads are not available right now. Try again later."));
  return new Promise((resolve, reject) => {
    const request = new XMLHttpRequest();
    request.open("PUT", intent.uploadUrl);
    const headerNames = Object.keys(intent.uploadHeaders).map((name) => name.toLowerCase());
    for (const [name, value] of Object.entries(intent.uploadHeaders)) if (!headersTheBrowserSetsItself.has(name.toLowerCase())) request.setRequestHeader(name, value);
    if (!headerNames.includes("content-type")) request.setRequestHeader("Content-Type", file.type);
    const csrfToken = readCsrfTokenForRequests();
    if (intent.uploadUrl.startsWith("/") && csrfToken) request.setRequestHeader("X-CSRF-Token", csrfToken);
    request.upload.onprogress = (event) => {
      if (event.lengthComputable) onProgress(event.loaded / event.total);
    };
    request.onload = () => (request.status >= 200 && request.status < 300 ? resolve() : reject(new AdsApiRequestError(request.status, "UPLOAD_FAILED", "The file could not be uploaded. Try again.")));
    request.onerror = () => reject(new AdsApiRequestError(0, "NETWORK_UNAVAILABLE", "The upload was interrupted. Check your connection and try again."));
    request.send(file);
  });
}

export async function uploadCreativeFile(accountId: string, file: File, onProgress: (fractionComplete: number) => void): Promise<UploadedMedia> {
  const metadata = await readMediaMetadataInBrowser(file);
  const clientMetadata = metadata ? { width: metadata.width, height: metadata.height, durationSeconds: metadata.durationSeconds === null ? null : Math.round(metadata.durationSeconds) } : null;
  const intent = await sendAdsApiRequest<MediaUploadIntent>(buildAccountApiPath(accountId, "/creatives/media/uploads"), {
    method: "POST",
    body: { fileName: file.name.slice(0, 200), mimeType: file.type, sizeBytes: file.size, clientMetadata },
  });
  await sendFileToUploadUrl(intent, file, onProgress);
  const mediaPath = buildAccountApiPath(accountId, `/creatives/media/${encodeURIComponent(intent.mediaId)}`);
  await sendAdsApiRequest<{ mediaId: string; status: string }>(`${mediaPath}/complete`, { method: "POST" });
  for (let attempt = 0; attempt < 20; attempt += 1) {
    const media = await sendAdsApiRequest<UploadedMedia>(mediaPath);
    if (media.status !== "processing") return media;
    await new Promise((resolve) => setTimeout(resolve, 1500));
  }
  return { mediaId: intent.mediaId, status: "processing", media: null };
}
