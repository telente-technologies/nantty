import type { MediaMimeType, MediaPurpose, MediaType } from "./mediaUpload.model.js";

export type MediaAssetStatus = "processing" | "ready" | "failed";
export type MediaVariantFormat = "avif" | "webp" | "jpeg" | "mp4" | "hls";

export const PUBLIC_FILE_PREFIX = "public/media/";

export interface MediaVariantRecord {
  readonly id: string;
  readonly assetId: string;
  readonly storageKey: string;
  readonly format: MediaVariantFormat;
  readonly contentType: string;
  readonly width: number;
  readonly height: number;
  readonly sizeBytes: number;
  readonly bitrateKbps: number | null;
}

export type NewMediaVariantInput = Omit<MediaVariantRecord, "id" | "assetId">;

export interface MediaAssetRecord {
  readonly id: string;
  readonly ownerId: string;
  readonly purpose: MediaPurpose;
  readonly type: MediaType;
  readonly mimeType: MediaMimeType;
  readonly status: MediaAssetStatus;
  readonly originalKey: string;
  readonly sizeBytes: number;
  readonly sha256: string;
  readonly width: number | null;
  readonly height: number | null;
  readonly durationSeconds: number | null;
  readonly blurhash: string | null;
  readonly posterKey: string | null;
  readonly hlsMasterKey: string | null;
  readonly failureReason: string | null;
  readonly processingAttempts: number;
  readonly createdAt: Date;
  readonly updatedAt: Date;
  readonly readyAt: Date | null;
  readonly variants: readonly MediaVariantRecord[];
}

export type NewMediaAssetInput = Pick<
  MediaAssetRecord,
  "id" | "ownerId" | "purpose" | "type" | "mimeType" | "originalKey" | "sizeBytes" | "sha256" | "createdAt"
>;

export interface ProcessedMediaResult {
  readonly width: number | null;
  readonly height: number | null;
  readonly durationSeconds: number | null;
  readonly blurhash: string | null;
  readonly posterKey: string | null;
  readonly hlsMasterKey: string | null;
  readonly variants: readonly NewMediaVariantInput[];
}

export function publicAssetPrefix(mediaId: string): string {
  return `${PUBLIC_FILE_PREFIX}${mediaId}/`;
}

export function isPublicFileKey(key: string): boolean {
  return key.startsWith(PUBLIC_FILE_PREFIX) && !key.split("/").some((segment) => segment === "" || segment === "." || segment === "..");
}

export function contentHashedFileKey(mediaId: string, contentSha256: string, extension: string): string {
  return `${publicAssetPrefix(mediaId)}${contentSha256.slice(0, 32)}.${extension}`;
}
