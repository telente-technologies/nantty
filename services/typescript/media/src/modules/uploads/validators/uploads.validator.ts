import { schema } from "@zudojs/schema";

export const mediaPurposeSchema = schema.enum(["post", "clip", "story", "avatar", "banner", "product", "chat", "voice", "document", "kyc", "adCreative", "dispute_evidence", "identity_document", "verification_document"]);

export const createUploadSessionBodySchema = schema.object({
  fileName: schema.string().min(1).max(255),
  mimeType: schema.string().min(3).max(100),
  sizeBytes: schema.number().int().min(1),
  purpose: mediaPurposeSchema,
  sha256: schema.string().regex(/^[0-9a-fA-F]{64}$/).optional(),
});

export const uploadParamsSchema = schema.object({ uploadId: schema.string().uuid() });
export const chunkParamsSchema = schema.object({ uploadId: schema.string().uuid(), chunkIndex: schema.coerce.number().int().min(0).max(9999) });
export const mediaParamsSchema = schema.object({ mediaId: schema.string().uuid() });
export const chunkUrlsBodySchema = schema.object({ chunkIndexes: schema.array(schema.number().int().min(0).max(9999)).min(1).max(16) });
