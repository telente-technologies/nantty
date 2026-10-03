import type { MediaPurposeName } from "../../../../constants/purposePolicy.constant.js";

export interface CreateUploadSessionCommand {
  readonly ownerId: string;
  readonly fileName: string;
  readonly mimeType: string;
  readonly sizeBytes: number;
  readonly purpose: MediaPurposeName;
  readonly sha256: string | undefined;
  readonly idempotencyKey: string | undefined;
}

export interface UploadSessionView {
  readonly mode: "single" | "multipart";
  readonly uploadId: string;
  readonly mediaId: string;
  readonly partSizeBytes: number;
  readonly partCount: number;
  readonly recommendedParallelism: number;
  readonly chunkSizeBytes: number;
  readonly totalChunks: number;
  readonly uploadedChunks: readonly number[];
  readonly uploadMode: "presigned" | "proxied";
  readonly expiresAt: string;
  readonly url?: string;
  readonly headers?: Readonly<Record<string, string>>;
}
