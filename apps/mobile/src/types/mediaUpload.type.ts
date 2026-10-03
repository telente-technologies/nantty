import type { ID } from "./models.type";

export type MediaUploadPurpose =
  | "post"
  | "clip"
  | "story"
  | "avatar"
  | "banner"
  | "product"
  | "chat"
  | "voice"
  | "document"
  | "dispute_evidence"
  | "identity_document"
  | "verification_document";
export type MediaUploadStatus = "uploading" | "processing" | "ready" | "failed";
export type MediaVariantFormat = "avif" | "webp" | "jpeg" | "mp4" | "hls";

export interface MediaVariant {
  readonly url: string;
  readonly width: number;
  readonly height: number;
  readonly format: MediaVariantFormat;
  readonly bitrateKbps?: number;
}

export interface MediaAsset {
  readonly id: ID;
  readonly type: "image" | "video" | "audio" | "document";
  readonly status: "processing" | "ready" | "failed";
  readonly purpose?: MediaUploadPurpose;
  readonly pageCount?: number;
  readonly failureReason?: string;
  readonly width: number;
  readonly height: number;
  readonly durationSeconds?: number;
  readonly blurhash?: string;
  readonly posterUrl?: string;
  readonly hlsUrl?: string;
  readonly variants: readonly MediaVariant[];
}

export interface CreateUploadSessionRequest {
  readonly fileName: string;
  readonly mimeType: string;
  readonly sizeBytes: number;
  readonly purpose: MediaUploadPurpose;
  readonly sha256?: string;
}

export interface UploadSession {
  readonly uploadId: ID;
  readonly mediaId: ID;
  readonly mode?: UploadMode;
  readonly partSizeBytes?: number;
  readonly partCount?: number;
  readonly chunkSizeBytes: number;
  readonly totalChunks: number;
  readonly uploadedChunks: readonly number[];
}

export interface UploadSessionStatus {
  readonly status: MediaUploadStatus;
  readonly uploadedChunks: readonly number[];
  readonly media?: MediaAsset;
}

export interface CompletedUpload {
  readonly mediaId: ID;
  readonly status: "processing";
}

export type UploadMode = "single" | "multipart";

export interface BatchChunkUploadUrls {
  readonly urls: readonly (ChunkUploadUrl & { readonly chunkIndex: number })[];
}

export interface ChunkUploadUrl {
  readonly url: string;
  readonly method: "PUT";
  readonly expectedBytes: number;
  readonly expiresAt: string;
}
