import { shouldUseMockForPath } from "@/config/api.config";
import type { ID, MediaAsset, MediaUploadPurpose, MediaVariant } from "@/types";

import type { LocalMediaFile } from "./mediaPreparation.service";
import {
  cancelAndRemoveUpload,
  enqueueLocalMediaForUpload,
  retryFailedUpload,
  startDrainingUploadQueue,
  waitForProcessedMediaAsset,
  waitForUploadedMediaId,
} from "./mediaUploadQueue.service";
import { mediaUploadTransport } from "./mediaUploadTransport.service";

export type { MediaUploadPurpose };
export type { LocalMediaFile };

const IMAGE_VARIANT_FORMAT_PREFERENCE: readonly MediaVariant["format"][] = ["jpeg", "webp", "avif"];

export function pickLargestDisplayableImageUrl(asset: MediaAsset): string | null {
  const imageVariants = asset.variants
    .filter((variant) => IMAGE_VARIANT_FORMAT_PREFERENCE.includes(variant.format))
    .sort(
      (a, b) =>
        b.width - a.width || IMAGE_VARIANT_FORMAT_PREFERENCE.indexOf(a.format) - IMAGE_VARIANT_FORMAT_PREFERENCE.indexOf(b.format),
    );
  return imageVariants[0]?.url ?? asset.posterUrl ?? null;
}

const describeLocalImageFromUri = (localUri: string, contentType: string): LocalMediaFile => ({
  uri: localUri,
  mediaType: contentType.startsWith("video/") ? "video" : "image",
  mimeType: contentType,
  fileName: localUri.split("/").pop() ?? null,
  sizeBytes: null,
  width: null,
  height: null,
  durationSeconds: null,
});

export const mediaService = {
  enqueueLocalMediaForUpload,
  retryFailedUpload,
  cancelAndRemoveUpload,
  resumePendingUploads: startDrainingUploadQueue,
  waitForUploadedMediaId,
  waitForProcessedMediaAsset,
  fetchMediaAssetById: (mediaId: ID) => mediaUploadTransport.fetchMediaAsset(mediaId),
  uploadLocalImageAndReturnPublicUrl: async (
    localUri: string,
    contentType: string,
    purpose: MediaUploadPurpose,
    onUploadJobCreated?: (jobId: ID) => void,
  ): Promise<string> => {
    const jobId = await enqueueLocalMediaForUpload(describeLocalImageFromUri(localUri, contentType), purpose);
    onUploadJobCreated?.(jobId);
    const asset = await waitForProcessedMediaAsset(jobId);
    if (shouldUseMockForPath("/api/v1/media")) return localUri;
    const publicUrl = pickLargestDisplayableImageUrl(asset);
    if (!publicUrl) throw new Error("Upload finished but no image is available yet. Please try again.");
    return publicUrl;
  },
};
