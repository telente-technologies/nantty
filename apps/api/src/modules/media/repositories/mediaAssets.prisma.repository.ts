import type { MediaAsset, MediaVariant } from "../../../generated/prisma/client.js";
import { prisma } from "../../../integrations/database.integration.js";
import type { MediaAssetRecord, MediaAssetStatus, MediaVariantFormat, MediaVariantRecord, NewMediaAssetInput, ProcessedMediaResult } from "../models/mediaAsset.model.js";
import type { MediaMimeType, MediaPurpose, MediaType } from "../models/mediaUpload.model.js";
import type { MediaAssetsRepository } from "./mediaAssets.repository.js";

type MediaAssetRow = MediaAsset & { readonly variants: readonly MediaVariant[] };

const WITH_VARIANTS = { variants: { orderBy: [{ format: "asc" as const }, { width: "asc" as const }] } };

function convertVariantRowToRecord(row: MediaVariant): MediaVariantRecord {
  return {
    id: row.id,
    assetId: row.assetId,
    storageKey: row.storageKey,
    format: row.format as MediaVariantFormat,
    contentType: row.contentType,
    width: row.width,
    height: row.height,
    sizeBytes: row.sizeBytes,
    bitrateKbps: row.bitrateKbps,
  };
}

function convertAssetRowToRecord(row: MediaAssetRow): MediaAssetRecord {
  return {
    ...row,
    purpose: row.purpose as MediaPurpose,
    type: row.type as MediaType,
    mimeType: row.mimeType as MediaMimeType,
    status: row.status as MediaAssetStatus,
    variants: row.variants.map(convertVariantRowToRecord),
  };
}

export class PrismaMediaAssetsRepository implements MediaAssetsRepository {
  public async create(input: NewMediaAssetInput): Promise<MediaAssetRecord> {
    return convertAssetRowToRecord(await prisma().mediaAsset.create({ data: { ...input }, include: WITH_VARIANTS }));
  }

  public async findById(id: string): Promise<MediaAssetRecord | undefined> {
    const row = await prisma().mediaAsset.findUnique({ where: { id }, include: WITH_VARIANTS });
    return row === null ? undefined : convertAssetRowToRecord(row);
  }

  public async findManyByIds(ids: readonly string[]): Promise<readonly MediaAssetRecord[]> {
    if (ids.length === 0) return [];
    const rows = await prisma().mediaAsset.findMany({ where: { id: { in: [...ids] } }, include: WITH_VARIANTS });
    return rows.map(convertAssetRowToRecord);
  }

  public async countProcessingAttempt(id: string): Promise<void> {
    await prisma().mediaAsset.updateMany({ where: { id }, data: { processingAttempts: { increment: 1 } } });
  }

  public async markReadyIfProcessing(id: string, result: ProcessedMediaResult, readyAt: Date): Promise<boolean> {
    return prisma().$transaction(async (transaction) => {
      const { variants, ...fields } = result;
      const updated = await transaction.mediaAsset.updateMany({
        where: { id, status: "processing" },
        data: { ...fields, status: "ready", failureReason: null, readyAt },
      });
      if (updated.count !== 1) return false;
      await transaction.mediaVariant.deleteMany({ where: { assetId: id } });
      await transaction.mediaVariant.createMany({ data: variants.map((variant) => ({ ...variant, assetId: id })) });
      return true;
    });
  }

  public async markFailedIfProcessing(id: string, reason: string): Promise<boolean> {
    const result = await prisma().mediaAsset.updateMany({ where: { id, status: "processing" }, data: { status: "failed", failureReason: reason } });
    return result.count === 1;
  }

  public async listProcessingUpdatedBefore(cutoff: Date, limit: number): Promise<readonly MediaAssetRecord[]> {
    const rows = await prisma().mediaAsset.findMany({
      where: { status: "processing", updatedAt: { lt: cutoff } },
      orderBy: { updatedAt: "asc" },
      take: limit,
      include: WITH_VARIANTS,
    });
    return rows.map(convertAssetRowToRecord);
  }

  public async delete(id: string): Promise<void> {
    await prisma().mediaAsset.deleteMany({ where: { id } });
  }
}
