import { createHash } from "node:crypto";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { downloadVariantFolder, downloadVariantRenderVersion, maximumDownloadRenderAttempts } from "../../../constants/media.constant.js";
import type { JobAttempt } from "../../../interfaces/jobQueue.interface.js";
import type { BrandedRenderResult } from "../../../interfaces/brandedDownloadRenderer.interface.js";
import type { HandlerContext } from "../../../types/handlerContext.type.js";
import { derivativeKeyFor } from "../../../utils/objectKeys.util.js";
import type { MediaAssetWithVariants } from "../../assets/models/mediaAsset.model.js";
import { mediaAssetRepository } from "../../assets/repositories/mediaAsset.repository.js";
import { isAudioMuted } from "../../assets/services/audioRemedy.service.js";
import { downloadVariantRepository, type DownloadVariantRow } from "../repositories/downloadVariant.repository.js";

type SourceVariant = MediaAssetWithVariants["variants"][number];

export function selectDownloadSource(asset: MediaAssetWithVariants): SourceVariant | undefined {
  if (asset.kind === "video") return asset.variants.find((variant) => variant.format === "mp4");
  if (asset.kind !== "image") return undefined;
  return [...asset.variants].filter((variant) => variant.format === "jpeg").sort((left, right) => right.width - left.width)[0];
}

export function computeDownloadCacheKey(sourceKey: string, watermarkHandle: string, stripAudio: boolean): string {
  return createHash("sha256").update(`${downloadVariantRenderVersion}|${sourceKey}|${watermarkHandle}|${stripAudio ? 1 : 0}`).digest("hex").slice(0, 32);
}

export const shouldStripDownloadAudio = (asset: MediaAssetWithVariants, requested: boolean) => requested || isAudioMuted(asset);

async function withWorkDirectory<T>(work: (directory: string) => Promise<T>): Promise<T> {
  const directory = await mkdtemp(join(tmpdir(), "zudomart-download-"));
  try {
    return await work(directory);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
}

async function storeRenderedVariant(context: HandlerContext, asset: MediaAssetWithVariants, row: DownloadVariantRow, rendered: BrandedRenderResult): Promise<DownloadVariantRow> {
  const bucket = context.config.storage.privateBucket;
  const key = derivativeKeyFor(asset.id, true, `${downloadVariantFolder}${row.cacheKey}.${rendered.format}`);
  await context.storage.putObject(bucket, key, { path: rendered.path }, { contentType: rendered.contentType, encrypted: true });
  return downloadVariantRepository.update(context.database.client, row.id, { status: "ready", bucket, key, contentType: rendered.contentType, sizeBytes: rendered.sizeBytes, readyAt: context.clock.now(), failureReason: null });
}

async function renderFromSource(context: HandlerContext, asset: MediaAssetWithVariants, row: DownloadVariantRow, source: SourceVariant): Promise<DownloadVariantRow> {
  return withWorkDirectory(async (directory) => {
    const inputPath = join(directory, `source.${source.format}`);
    await context.storage.downloadToFile(source.bucket, source.key, inputPath);
    const rendered = asset.kind === "image"
      ? await context.branding.renderBrandedImage({ inputPath, outputPath: join(directory, "download.jpg"), watermarkHandle: row.watermarkHandle })
      : await context.branding.renderBrandedVideo({ inputPath, workDirectory: directory, watermarkHandle: row.watermarkHandle, stripAudio: row.stripAudio });
    return storeRenderedVariant(context, asset, row, rendered);
  });
}

export async function renderImageDownloadVariantNow(context: HandlerContext, asset: MediaAssetWithVariants, row: DownloadVariantRow, source: SourceVariant): Promise<DownloadVariantRow> {
  await downloadVariantRepository.update(context.database.client, row.id, { status: "rendering", startedAt: context.clock.now(), attempts: { increment: 1 } });
  try {
    return await renderFromSource(context, asset, row, source);
  } catch (error) {
    await downloadVariantRepository.update(context.database.client, row.id, { status: "failed", failureReason: error instanceof Error ? error.message.slice(0, 300) : "render failed" });
    throw error;
  }
}

export async function renderQueuedDownloadVariant(context: HandlerContext, variantId: string, attempt: JobAttempt): Promise<"ready" | "skipped"> {
  const row = await downloadVariantRepository.findById(context.database.client, variantId);
  if (row === null || row.status === "ready") return "skipped";
  const asset = await mediaAssetRepository.findById(context.database.client, row.assetId);
  const source = asset === null || asset.status !== "ready" ? undefined : selectDownloadSource(asset);
  if (asset === null || source === undefined || source.key !== row.sourceKey) {
    await downloadVariantRepository.update(context.database.client, row.id, { status: "failed", failureReason: "SOURCE_CHANGED" });
    return "skipped";
  }
  const started = await downloadVariantRepository.update(context.database.client, row.id, { status: "rendering", startedAt: context.clock.now(), attempts: { increment: 1 } });
  try {
    await renderFromSource(context, asset, started, source);
    return "ready";
  } catch (error) {
    const exhausted = attempt.isFinalAttempt || started.attempts >= maximumDownloadRenderAttempts;
    await downloadVariantRepository.update(context.database.client, row.id, { status: exhausted ? "failed" : "pending", failureReason: error instanceof Error ? error.message.slice(0, 300) : "render failed" });
    if (exhausted) return "skipped";
    throw error;
  }
}
