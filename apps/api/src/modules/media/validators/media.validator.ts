import { schema, type Infer } from "@zudojs/schema";

import { MEDIA_CONTENT_TYPES, MEDIA_PURPOSES } from "../models/media.model.js";

export const CreateUploadBodySchema = schema.object({
  purpose: schema.enum(MEDIA_PURPOSES),
  contentType: schema.enum(MEDIA_CONTENT_TYPES),
  size: schema.number().int().min(1),
});

export const MediaParamsSchema = schema.object({ id: schema.string().uuid() });

export const UploadQuerySchema = schema.object({
  expires: schema.coerce.number().int().min(0),
  signature: schema.string().regex(/^[a-f0-9]{64}$/),
});

export type CreateUploadBody = Infer<typeof CreateUploadBodySchema>;
