import { derivativePrefixFor } from "../../../utils/objectKeys.util.js";
import type { HandlerContext } from "../../../types/handlerContext.type.js";
import { mediaAssetRepository } from "../repositories/mediaAsset.repository.js";
import { derivativeBucketFor } from "./derivativePublishing.service.js";
import { mediaEvents } from "./mediaEvents.service.js";
import { discardDownloadVariants } from "../../downloads/services/downloadVariantCleanup.service.js";

export async function deleteMediaAssets(context: HandlerContext, mediaIds: readonly string[], reason: string): Promise<number> {
  if (mediaIds.length === 0) return 0;
  const assets = await mediaAssetRepository.findManyByIds(context.database.client, mediaIds);
  let deleted = 0;
  for (const asset of assets) {
    if (asset.status === "deleted") continue;
    await context.storage.deletePrefix(derivativeBucketFor(context, asset.isPrivate), derivativePrefixFor(asset.id, asset.isPrivate));
    await context.storage.deleteObject(asset.quarantineBucket, asset.quarantineKey).catch(() => undefined);
    await discardDownloadVariants(context, asset.id);
    const now = context.clock.now();
    await context.database.transaction(async (transaction) => {
      await transaction.mediaVariant.deleteMany({ where: { assetId: asset.id } });
      await mediaAssetRepository.update(transaction, asset.id, { status: "deleted", deletedAt: now, posterKey: null, hlsKey: null });
      await mediaEvents.deleted(transaction, asset, reason, now);
    });
    deleted += 1;
  }
  return deleted;
}

export async function deleteExpiredMedia(context: HandlerContext, batchSize = 200): Promise<number> {
  let total = 0;
  for (;;) {
    const expired = await mediaAssetRepository.findExpired(context.database.client, context.clock.now(), batchSize);
    if (expired.length === 0) return total;
    const deleted = await deleteMediaAssets(context, expired.map((row) => row.id), "expired");
    total += deleted;
    if (expired.length < batchSize || deleted === 0) return total;
  }
}
