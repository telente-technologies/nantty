import { schema, type Infer } from "@zudojs/schema";

import { MEDIA_MIME_TYPES, MEDIA_PURPOSES } from "../models/mediaUpload.model.js";

const SHA256_HEX = /^[a-fA-F0-9]{64}$/;

export const CreateUploadBodySchema = schema.object({
  fileName: schema.string().min(1).max(255),
  mimeType: schema.enum(MEDIA_MIME_TYPES),
  sizeBytes: schema.number().int().min(1).max(Number.MAX_SAFE_INTEGER),
  purpose: schema.enum(MEDIA_PURPOSES),
  sha256: schema.string().regex(SHA256_HEX).optional(),
});

export const UploadParamsSchema = schema.object({ uploadId: schema.string().uuid() });

export const UploadChunkParamsSchema = schema.object({
  uploadId: schema.string().uuid(),
  chunkIndex: schema.coerce.number().int().min(0).max(100_000),
});

export const ChunkHashHeaderSchema = schema.string().regex(SHA256_HEX);

export const MediaParamsSchema = schema.object({ mediaId: schema.string().uuid() });

export const MediaFileParamsSchema = schema.object({ key: schema.string().min(1).max(512).regex(/^[A-Za-z0-9._\-/]+$/) });

export type CreateUploadBody = Infer<typeof CreateUploadBodySchema>;
