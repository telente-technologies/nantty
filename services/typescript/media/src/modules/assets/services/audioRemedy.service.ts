import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { mutedDerivativeFolder } from "../../../constants/media.constant.js";
import type { HandlerContext } from "../../../types/handlerContext.type.js";
import type { MediaAssetWithVariants } from "../models/mediaAsset.model.js";
import { mediaAssetRepository } from "../repositories/mediaAsset.repository.js";
import { derivativeBucketFor, uploadDerivatives } from "./derivativePublishing.service.js";
import { mediaEvents } from "./mediaEvents.service.js";
import { discardDownloadVariants } from "../../downloads/services/downloadVariantCleanup.service.js";
import { derivativeKeyFor } from "../../../utils/objectKeys.util.js";

export type AudioRemedyOutcome = "muted" | "restored" | "skipped";

const mutedSegment = `/${mutedDerivativeFolder}`;

export const isAudioMuted = (asset: Pick<MediaAssetWithVariants, "hlsKey" | "variants">): boolean =>
  (asset.hlsKey?.includes(mutedSegment) ?? false) || asset.variants.some((variant) => variant.key.includes(mutedSegment));

export const originalKeyForMutedKey = (key: string): string => key.replace(mutedSegment, "/");

function canCarryRemedy(asset: MediaAssetWithVariants | null): asset is MediaAssetWithVariants {
  return asset !== null && asset.status === "ready" && asset.kind === "video";
}

export async function muteMediaAudio(context: HandlerContext, mediaId: string, claimId: string | null): Promise<AudioRemedyOutcome> {
  const asset = await mediaAssetRepository.findById(context.database.client, mediaId);
  if (!canCarryRemedy(asset) || isAudioMuted(asset)) return "skipped";
  const source = asset.variants.find((variant) => variant.format === "mp4");
  if (source === undefined) return "skipped";
  const workDirectory = await mkdtemp(join(tmpdir(), "zudomart-mute-"));
  try {
    const inputPath = join(workDirectory, "source.mp4");
    await context.storage.downloadToFile(source.bucket, source.key, inputPath);
    const processed = await context.transcoder.muteVideoAudio({ inputPath, workDirectory });
    await uploadDerivatives(context, asset.id, asset.isPrivate, processed.files);
    const bucket = derivativeBucketFor(context, asset.isPrivate);
    const now = context.clock.now();
    await context.database.transaction(async (transaction) => {
      await transaction.mediaVariant.deleteMany({ where: { assetId: asset.id } });
      await transaction.mediaVariant.createMany({
        data: processed.files.filter((file) => file.isVariant).map((file) => ({ assetId: asset.id, bucket, key: derivativeKeyFor(asset.id, asset.isPrivate, file.name), format: file.format, width: file.width, height: file.height, bitrateKbps: file.bitrateKbps ?? null, sizeBytes: file.sizeBytes })),
      });
      await mediaAssetRepository.update(transaction, asset.id, processed.hlsMasterName === undefined ? {} : { hlsKey: derivativeKeyFor(asset.id, asset.isPrivate, processed.hlsMasterName) });
      const muted = await mediaAssetRepository.findById(transaction, asset.id);
      if (muted === null) return;
      await mediaEvents.processed(transaction, muted, now);
      await mediaEvents.audioMuted(transaction, muted, claimId, now);
    });
    await discardDownloadVariants(context, asset.id);
    return "muted";
  } finally {
    await rm(workDirectory, { recursive: true, force: true });
  }
}

export async function restoreMediaAudio(context: HandlerContext, mediaId: string, claimId: string | null): Promise<AudioRemedyOutcome> {
  const asset = await mediaAssetRepository.findById(context.database.client, mediaId);
  if (!canCarryRemedy(asset) || !isAudioMuted(asset)) return "skipped";
  const restored = await Promise.all(asset.variants.map(async (variant) => {
    const key = originalKeyForMutedKey(variant.key);
    const head = await context.storage.headObject(variant.bucket, key);
    return head === undefined ? undefined : { assetId: asset.id, bucket: variant.bucket, key, format: variant.format, width: variant.width, height: variant.height, bitrateKbps: variant.bitrateKbps, sizeBytes: head.sizeBytes };
  }));
  if (restored.some((variant) => variant === undefined)) return "skipped";
  const now = context.clock.now();
  await context.database.transaction(async (transaction) => {
    await transaction.mediaVariant.deleteMany({ where: { assetId: asset.id } });
    await transaction.mediaVariant.createMany({ data: restored.filter((variant) => variant !== undefined) });
    await mediaAssetRepository.update(transaction, asset.id, asset.hlsKey === null ? {} : { hlsKey: originalKeyForMutedKey(asset.hlsKey) });
    const original = await mediaAssetRepository.findById(transaction, asset.id);
    if (original === null) return;
    await mediaEvents.processed(transaction, original, now);
    await mediaEvents.audioRestored(transaction, original, claimId, now);
  });
  return "restored";
}
