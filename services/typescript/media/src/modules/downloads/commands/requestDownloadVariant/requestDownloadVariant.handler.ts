import { downloadablePurposes, downloadSignedUrlLifetimeSeconds, maximumDownloadRenderAttempts, mediaJobQueueName, renderDownloadVariantJobType } from "../../../../constants/media.constant.js";
import { conflict, notFound, unprocessable } from "../../../../errors/media.error.js";
import type { Handler, HandlerContext } from "../../../../types/handlerContext.type.js";
import { normalizeWatermarkHandle } from "../../../../utils/brandWatermark.util.js";
import { isUniqueConstraintViolationError } from "../../../../utils/prismaError.util.js";
import type { MediaAssetWithVariants } from "../../../assets/models/mediaAsset.model.js";
import { mediaAssetRepository } from "../../../assets/repositories/mediaAsset.repository.js";
import type { DownloadVariantView } from "../../models/downloadVariant.model.js";
import { downloadVariantRepository, type DownloadVariantRow } from "../../repositories/downloadVariant.repository.js";
import { computeDownloadCacheKey, renderImageDownloadVariantNow, selectDownloadSource, shouldStripDownloadAudio } from "../../services/downloadVariantRendering.service.js";
import type { RequestDownloadVariantCommand } from "./requestDownloadVariant.command.js";

const pollIntervalMs = 1500;

export function estimateDownloadRenderProgress(row: Pick<DownloadVariantRow, "status" | "startedAt">, durationSeconds: number, now: Date): number {
  if (row.status !== "rendering" || row.startedAt === null) return 0.02;
  const expectedSeconds = 4 + Math.max(1, durationSeconds) * 0.6;
  const elapsedSeconds = (now.getTime() - row.startedAt.getTime()) / 1000;
  return Math.round(Math.min(0.95, Math.max(0.05, elapsedSeconds / expectedSeconds)) * 100) / 100;
}

async function signReadyVariant(context: HandlerContext, asset: MediaAssetWithVariants, row: DownloadVariantRow, requesterId: string): Promise<DownloadVariantView> {
  if (row.bucket === null || row.key === null) throw conflict("DOWNLOAD_NOT_READY", "This download is still being prepared.");
  const extension = row.key.slice(row.key.lastIndexOf(".") + 1);
  const fileName = `zudomart-${row.watermarkHandle}-${asset.id.slice(0, 8)}.${extension}`;
  const expiresAt = new Date(context.clock.now().getTime() + downloadSignedUrlLifetimeSeconds * 1000);
  await context.database.client.mediaAccessLog.create({ data: { mediaId: asset.id, actorId: requesterId, reason: "branded_download", expiresAt } });
  const url = await context.storage.signGetUrl(row.bucket, row.key, downloadSignedUrlLifetimeSeconds, fileName);
  return { status: "ready", progress: 1, url, expiresAt: expiresAt.toISOString(), fileName, contentType: row.contentType ?? "application/octet-stream", sizeBytes: Number(row.sizeBytes ?? 0) };
}

async function queueVideoRender(context: HandlerContext, row: DownloadVariantRow): Promise<void> {
  await context.jobs.enqueueJob(mediaJobQueueName, { id: `download-${row.id}-${row.attempts}`, type: renderDownloadVariantJobType, payload: { variantId: row.id } });
}

async function createPendingOrReuse(context: HandlerContext, data: Parameters<typeof downloadVariantRepository.createPending>[1]): Promise<{ readonly row: DownloadVariantRow; readonly isNew: boolean } | undefined> {
  try {
    return { row: await downloadVariantRepository.createPending(context.database.client, data), isNew: true };
  } catch (error) {
    if (!isUniqueConstraintViolationError(error)) throw error;
    const row = await downloadVariantRepository.findByCacheKey(context.database.client, data.assetId, data.cacheKey);
    return row === null ? undefined : { row, isNew: false };
  }
}

export function createRequestDownloadVariantHandler(context: HandlerContext): Handler<RequestDownloadVariantCommand, DownloadVariantView> {
  return async (command) => {
    const watermarkHandle = normalizeWatermarkHandle(command.watermarkHandle);
    if (watermarkHandle === undefined) throw unprocessable("INVALID_WATERMARK_HANDLE", "The watermark username is not valid.");
    const asset = await mediaAssetRepository.findById(context.database.client, command.mediaId);
    if (asset === null || asset.status === "deleted" || asset.status === "rejected") throw notFound("MEDIA_NOT_FOUND", "Media not found");
    if (!downloadablePurposes.has(asset.purpose) || (asset.kind !== "image" && asset.kind !== "video")) throw unprocessable("MEDIA_NOT_DOWNLOADABLE", "This file can't be downloaded.");
    if (asset.status !== "ready") throw conflict("MEDIA_NOT_READY", "This file is still being processed.");
    const source = selectDownloadSource(asset);
    if (source === undefined) throw conflict("MEDIA_NOT_READY", "This file is still being processed.");
    const stripAudio = asset.kind === "video" && shouldStripDownloadAudio(asset, command.stripAudio);
    const cacheKey = computeDownloadCacheKey(source.key, watermarkHandle, stripAudio);
    const db = context.database.client;
    const existing = await downloadVariantRepository.findByCacheKey(db, asset.id, cacheKey);
    if (existing?.status === "ready") return signReadyVariant(context, asset, existing, command.requesterId);
    const created = existing === null ? await createPendingOrReuse(context, { assetId: asset.id, cacheKey, watermarkHandle, sourceKey: source.key, stripAudio }) : undefined;
    const row = existing ?? created?.row;
    if (row === undefined) throw conflict("DOWNLOAD_NOT_READY", "This download is still being prepared.");
    if (row.status === "ready") return signReadyVariant(context, asset, row, command.requesterId);
    if (asset.kind === "image") return signReadyVariant(context, asset, await renderImageDownloadVariantNow(context, asset, row, source), command.requesterId);
    if (row.status === "failed") {
      if (row.attempts >= maximumDownloadRenderAttempts && row.startedAt !== null && context.clock.now().getTime() - row.startedAt.getTime() < 15 * 60_000) {
        throw unprocessable("DOWNLOAD_RENDER_FAILED", "We couldn't prepare this download. Try again later.");
      }
      const reset = await downloadVariantRepository.update(db, row.id, { status: "pending", attempts: 0, failureReason: null });
      await queueVideoRender(context, reset);
      return { status: "processing", progress: 0.02, retryAfterMs: pollIntervalMs };
    }
    if (created?.isNew === true) await queueVideoRender(context, row);
    return { status: "processing", progress: estimateDownloadRenderProgress(row, asset.durationSeconds ?? 0, context.clock.now()), retryAfterMs: pollIntervalMs };
  };
}
