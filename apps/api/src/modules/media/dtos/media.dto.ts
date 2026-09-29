import type { MediaAssetRecord, MediaAssetStatus, MediaVariantFormat } from "../models/mediaAsset.model.js";
import { isPrivatePurpose, type MediaType, type UploadChunkRecord } from "../models/mediaUpload.model.js";

export interface MediaVariantDto {
  readonly url: string;
  readonly width: number;
  readonly height: number;
  readonly format: MediaVariantFormat;
  readonly bitrateKbps?: number;
}

export interface MediaAssetDto {
  readonly id: string;
  readonly type: MediaType;
  readonly status: MediaAssetStatus;
  readonly width: number | null;
  readonly height: number | null;
  readonly durationSeconds?: number;
  readonly blurhash?: string;
  readonly posterUrl?: string;
  readonly hlsUrl?: string;
  readonly originalUrl?: string;
  readonly failureReason?: string;
  readonly variants: readonly MediaVariantDto[];
}

export interface UploadSessionCreatedDto {
  readonly uploadId: string;
  readonly chunkSizeBytes: number;
  readonly totalChunks: number;
  readonly uploadedChunks: readonly number[];
}

export interface UploadProgressDto {
  readonly status: "uploading" | "processing" | "ready" | "failed";
  readonly uploadedChunks: readonly number[];
  readonly failureReason?: string;
  readonly media?: MediaAssetDto;
}

export interface UploadCompletedDto {
  readonly mediaId: string;
  readonly status: MediaAssetStatus;
}

export interface MediaUrlBuilder {
  buildPublicFileUrl(storageKey: string): string;
  buildOriginalFileUrl(mediaId: string): string;
}

export function listUploadedChunkIndexes(chunks: readonly UploadChunkRecord[]): readonly number[] {
  return chunks.map((chunk) => chunk.chunkIndex).sort((left, right) => left - right);
}

export function convertMediaAssetToDto(asset: MediaAssetRecord, urls: MediaUrlBuilder, viewerIsOwner: boolean): MediaAssetDto {
  const isPrivate = isPrivatePurpose(asset.purpose);
  const variants = isPrivate
    ? []
    : asset.variants.map((variant) => ({
        url: urls.buildPublicFileUrl(variant.storageKey),
        width: variant.width,
        height: variant.height,
        format: variant.format,
        ...(variant.bitrateKbps === null ? {} : { bitrateKbps: variant.bitrateKbps }),
      }));
  return {
    id: asset.id,
    type: asset.type,
    status: asset.status,
    width: asset.width,
    height: asset.height,
    ...(asset.durationSeconds === null ? {} : { durationSeconds: asset.durationSeconds }),
    ...(asset.blurhash === null || isPrivate ? {} : { blurhash: asset.blurhash }),
    ...(asset.posterKey === null || isPrivate ? {} : { posterUrl: urls.buildPublicFileUrl(asset.posterKey) }),
    ...(asset.hlsMasterKey === null || isPrivate ? {} : { hlsUrl: urls.buildPublicFileUrl(asset.hlsMasterKey) }),
    ...(isPrivate && asset.status === "ready" ? { originalUrl: urls.buildOriginalFileUrl(asset.id) } : {}),
    ...(viewerIsOwner && asset.failureReason !== null ? { failureReason: asset.failureReason } : {}),
    variants,
  };
}
