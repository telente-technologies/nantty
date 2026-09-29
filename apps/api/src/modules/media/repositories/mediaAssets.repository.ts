import { randomUUID } from "node:crypto";

import type { MediaAssetRecord, NewMediaAssetInput, ProcessedMediaResult } from "../models/mediaAsset.model.js";

export interface MediaAssetsRepository {
  create(input: NewMediaAssetInput): Promise<MediaAssetRecord>;
  findById(id: string): Promise<MediaAssetRecord | undefined>;
  findManyByIds(ids: readonly string[]): Promise<readonly MediaAssetRecord[]>;
  countProcessingAttempt(id: string): Promise<void>;
  markReadyIfProcessing(id: string, result: ProcessedMediaResult, readyAt: Date): Promise<boolean>;
  markFailedIfProcessing(id: string, reason: string): Promise<boolean>;
  listProcessingUpdatedBefore(cutoff: Date, limit: number): Promise<readonly MediaAssetRecord[]>;
  delete(id: string): Promise<void>;
}

export class InMemoryMediaAssetsRepository implements MediaAssetsRepository {
  private readonly assets = new Map<string, MediaAssetRecord>();

  public async create(input: NewMediaAssetInput): Promise<MediaAssetRecord> {
    const record: MediaAssetRecord = {
      ...input,
      status: "processing",
      width: null,
      height: null,
      durationSeconds: null,
      blurhash: null,
      posterKey: null,
      hlsMasterKey: null,
      failureReason: null,
      processingAttempts: 0,
      updatedAt: input.createdAt,
      readyAt: null,
      variants: [],
    };
    this.assets.set(record.id, record);
    return record;
  }

  public async findById(id: string): Promise<MediaAssetRecord | undefined> {
    return this.assets.get(id);
  }

  public async findManyByIds(ids: readonly string[]): Promise<readonly MediaAssetRecord[]> {
    return ids.flatMap((id) => {
      const asset = this.assets.get(id);
      return asset === undefined ? [] : [asset];
    });
  }

  public async countProcessingAttempt(id: string): Promise<void> {
    const asset = this.assets.get(id);
    if (asset !== undefined) this.assets.set(id, { ...asset, processingAttempts: asset.processingAttempts + 1 });
  }

  public async markReadyIfProcessing(id: string, result: ProcessedMediaResult, readyAt: Date): Promise<boolean> {
    const asset = this.assets.get(id);
    if (asset === undefined || asset.status !== "processing") return false;
    const variants = result.variants.map((variant) => ({ ...variant, id: randomUUID(), assetId: id }));
    this.assets.set(id, { ...asset, ...result, variants, status: "ready", failureReason: null, readyAt, updatedAt: readyAt });
    return true;
  }

  public async markFailedIfProcessing(id: string, reason: string): Promise<boolean> {
    const asset = this.assets.get(id);
    if (asset === undefined || asset.status !== "processing") return false;
    this.assets.set(id, { ...asset, status: "failed", failureReason: reason });
    return true;
  }

  public async listProcessingUpdatedBefore(cutoff: Date, limit: number): Promise<readonly MediaAssetRecord[]> {
    return [...this.assets.values()].filter((asset) => asset.status === "processing" && asset.updatedAt < cutoff).slice(0, limit);
  }

  public async delete(id: string): Promise<void> {
    this.assets.delete(id);
  }
}
