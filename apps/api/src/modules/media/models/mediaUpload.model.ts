export const MEDIA_PURPOSES = ["post", "clip", "story", "avatar", "banner", "product", "chat", "kyc", "voice"] as const;
export type MediaPurpose = (typeof MEDIA_PURPOSES)[number];

export const IMAGE_MIME_TYPES = ["image/jpeg", "image/png", "image/webp", "image/heic"] as const;
export const VIDEO_MIME_TYPES = ["video/mp4", "video/quicktime"] as const;
export const DOCUMENT_MIME_TYPES = ["application/pdf"] as const;
export const AUDIO_MIME_TYPES = ["audio/mpeg", "audio/mp4", "audio/aac", "audio/ogg", "audio/webm"] as const;
export const MEDIA_MIME_TYPES = [...IMAGE_MIME_TYPES, ...VIDEO_MIME_TYPES, ...DOCUMENT_MIME_TYPES, ...AUDIO_MIME_TYPES] as const;
export type MediaMimeType = (typeof MEDIA_MIME_TYPES)[number];
export type MediaType = "image" | "video" | "document" | "audio";

export type UploadSessionStatus = "uploading" | "assembling" | "completed" | "failed";

export interface UploadSessionRecord {
  readonly id: string;
  readonly ownerId: string;
  readonly fileName: string;
  readonly mimeType: MediaMimeType;
  readonly purpose: MediaPurpose;
  readonly sizeBytes: number;
  readonly chunkSizeBytes: number;
  readonly totalChunks: number;
  readonly expectedSha256: string | null;
  readonly status: UploadSessionStatus;
  readonly failureReason: string | null;
  readonly mediaId: string | null;
  readonly createdAt: Date;
  readonly updatedAt: Date;
}

export type NewUploadSessionInput = Pick<
  UploadSessionRecord,
  "id" | "ownerId" | "fileName" | "mimeType" | "purpose" | "sizeBytes" | "chunkSizeBytes" | "totalChunks" | "expectedSha256" | "createdAt"
>;

export interface UploadChunkRecord {
  readonly uploadId: string;
  readonly chunkIndex: number;
  readonly sizeBytes: number;
  readonly sha256: string;
  readonly storageKey: string;
}

const IMAGE_ONLY_PURPOSES: readonly MediaPurpose[] = ["avatar", "banner", "product"];
const VIDEO_ONLY_PURPOSES: readonly MediaPurpose[] = ["clip"];

export function mediaTypeForMimeType(mimeType: MediaMimeType): MediaType {
  if ((IMAGE_MIME_TYPES as readonly string[]).includes(mimeType)) return "image";
  if ((VIDEO_MIME_TYPES as readonly string[]).includes(mimeType)) return "video";
  if ((AUDIO_MIME_TYPES as readonly string[]).includes(mimeType)) return "audio";
  return "document";
}

export function purposeAllowsMimeType(purpose: MediaPurpose, mimeType: MediaMimeType): boolean {
  const type = mediaTypeForMimeType(mimeType);
  if (purpose === "kyc") return type === "image" || type === "document";
  if (purpose === "voice") return type === "audio";
  if (type === "document" || type === "audio") return false;
  if (IMAGE_ONLY_PURPOSES.includes(purpose)) return type === "image";
  if (VIDEO_ONLY_PURPOSES.includes(purpose)) return type === "video";
  return true;
}

export function isPrivatePurpose(purpose: MediaPurpose): boolean {
  return purpose === "kyc" || purpose === "voice";
}

export function adminsMayReadPurpose(purpose: MediaPurpose): boolean {
  return purpose === "kyc";
}

export function countChunksForFile(sizeBytes: number, chunkSizeBytes: number): number {
  return Math.max(1, Math.ceil(sizeBytes / chunkSizeBytes));
}

export function expectedChunkLength(upload: Pick<UploadSessionRecord, "sizeBytes" | "chunkSizeBytes" | "totalChunks">, chunkIndex: number): number {
  if (chunkIndex < upload.totalChunks - 1) return upload.chunkSizeBytes;
  return upload.sizeBytes - upload.chunkSizeBytes * (upload.totalChunks - 1);
}

export function chunkStorageKey(uploadId: string, chunkIndex: number, sha256: string): string {
  return `private/uploads/${uploadId}/${chunkIndex}-${sha256}`;
}

export function originalStorageKey(mediaId: string): string {
  return `private/originals/${mediaId}`;
}
