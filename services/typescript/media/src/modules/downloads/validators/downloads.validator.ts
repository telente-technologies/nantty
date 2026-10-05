import { schema } from "@zudojs/schema";

export const downloadVariantParamsSchema = schema.object({ mediaId: schema.string().uuid() });
export const downloadVariantBodySchema = schema.object({
  requesterId: schema.string().min(1).max(100),
  watermarkHandle: schema.string().min(1).max(31),
  stripAudio: schema.boolean().optional(),
});
