import type { ID, MediaAsset, MediaUploadPurpose } from "@/types";

import { sendRequestToWebappServer } from "./clientApi.service";
import { mediaUploadService, type UploadProgress } from "./mediaUpload.service";

const IMAGE_VARIANT_FORMAT_PREFERENCE = ["jpeg", "webp", "avif"] as const;
const PROCESSING_POLL_INTERVAL_MS = 1_200;
const PROCESSING_POLL_ATTEMPTS = 40;

export function pickLargestDisplayableImageUrl(asset: MediaAsset): string | null {
  const preference: readonly string[] = IMAGE_VARIANT_FORMAT_PREFERENCE;
  const images = asset.variants
    .filter((variant) => preference.includes(variant.format))
    .sort((left, right) => right.width - left.width || preference.indexOf(left.format) - preference.indexOf(right.format));
  return images[0]?.url ?? asset.posterUrl ?? null;
}

const pause = (milliseconds: number, signal?: AbortSignal) =>
  new Promise<void>((resolve, reject) => {
    const timer = setTimeout(resolve, milliseconds);
    signal?.addEventListener("abort", () => {
      clearTimeout(timer);
      reject(new DOMException("Upload cancelled", "AbortError"));
    }, { once: true });
  });

export async function waitForProcessedMediaAsset(mediaId: ID, signal?: AbortSignal): Promise<MediaAsset> {
  for (let attempt = 0; attempt < PROCESSING_POLL_ATTEMPTS; attempt++) {
    const asset = await sendRequestToWebappServer<MediaAsset>(`/api/v1/media/${encodeURIComponent(mediaId)}`, { signal });
    if (asset.status === "ready") return asset;
    if (asset.status === "failed") throw new Error("We couldn't process that file. Try a different one.");
    await pause(PROCESSING_POLL_INTERVAL_MS, signal);
  }
  throw new Error("Processing is taking longer than usual. Try again in a moment.");
}

export async function uploadImageAndReturnPublicUrl(file: File, purpose: MediaUploadPurpose, onProgress: (progress: UploadProgress) => void = () => undefined, signal?: AbortSignal): Promise<string> {
  const { mediaId } = await mediaUploadService.uploadFile(file, purpose, onProgress, signal);
  const asset = await waitForProcessedMediaAsset(mediaId, signal);
  const publicUrl = pickLargestDisplayableImageUrl(asset);
  if (!publicUrl) throw new Error("Upload finished but no image is available yet. Please try again.");
  return publicUrl;
}
