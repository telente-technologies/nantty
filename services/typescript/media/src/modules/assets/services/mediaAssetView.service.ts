import { kycPurposes, type MediaPurposeName } from "../../../constants/purposePolicy.constant.js";
import { privateSignedUrlLifetimeSeconds } from "../../../constants/media.constant.js";
import type { HandlerContext } from "../../../types/handlerContext.type.js";
import type { MediaAssetView, MediaAssetWithVariants, MediaVariantView } from "../models/mediaAsset.model.js";

export function toClientStatus(status: MediaAssetWithVariants["status"]): MediaAssetView["status"] {
  if (status === "ready") return "ready";
  return status === "rejected" || status === "deleted" ? "failed" : "processing";
}

export async function buildMediaAssetView(context: HandlerContext, asset: MediaAssetWithVariants): Promise<MediaAssetView> {
  const hidden = kycPurposes.has(asset.purpose as MediaPurposeName);
  const urlFor = (bucket: string, key: string) => (asset.isPrivate ? context.urls.privateUrl(bucket, key, privateSignedUrlLifetimeSeconds, { allowCdn: true }) : Promise.resolve(context.urls.publicUrl(key)));
  const ready = asset.status === "ready" && !hidden;
  const variants: MediaVariantView[] = ready
    ? await Promise.all(asset.variants.map(async (variant) => ({ url: await urlFor(variant.bucket, variant.key), width: variant.width, height: variant.height, format: variant.format, ...(variant.bitrateKbps === null ? {} : { bitrateKbps: variant.bitrateKbps }) })))
    : [];
  const bucket = asset.variants[0]?.bucket ?? context.config.storage.publicBucket;
  return {
    id: asset.id,
    type: asset.kind,
    status: toClientStatus(asset.status),
    purpose: asset.purpose,
    width: asset.width,
    height: asset.height,
    ...(asset.durationSeconds === null ? {} : { durationSeconds: asset.durationSeconds }),
    ...(asset.pageCount === null ? {} : { pageCount: asset.pageCount }),
    ...(asset.blurhash === null ? {} : { blurhash: asset.blurhash }),
    ...(ready && asset.posterKey !== null ? { posterUrl: await urlFor(bucket, asset.posterKey) } : {}),
    ...(ready && asset.hlsKey !== null ? { hlsUrl: await urlFor(bucket, asset.hlsKey) } : {}),
    variants,
    ...(asset.status === "rejected" && asset.rejectionReason !== null ? { failureReason: asset.rejectionReason } : {}),
    ...(asset.rejectionReason === "UNSUPPORTED_IMAGE_FORMAT" ? { failureHint: "Convert the photo to JPEG and upload it again." } : {}),
  };
}
