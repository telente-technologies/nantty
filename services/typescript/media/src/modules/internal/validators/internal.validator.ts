import { schema } from "@nantty/fastify-platform";

export const uploadIntentBodySchema = schema.object({
  accountId: schema.string().uuid(),
  purpose: schema.enum(["avatar", "banner", "post"]),
  contentType: schema.string().min(3).max(100),
  sizeBytes: schema.number().int().min(1),
  fileName: schema.string().min(1).max(255).optional(),
});
export const privateAccessBodySchema = schema.object({ actorId: schema.string().min(1).max(100), reason: schema.string().min(3).max(300), variant: schema.string().max(100).optional(), download: schema.boolean().optional() });
export const reviewBodySchema = schema.object({ decision: schema.enum(["approve", "reject"]), reviewerId: schema.string().min(1).max(100) });
export const deleteMediaBodySchema = schema.object({ mediaIds: schema.array(schema.string().uuid()).min(1).max(500), reason: schema.string().min(3).max(100) });
export const internalCompleteBodySchema = schema.object({ accountId: schema.string().uuid() });
export const internalMediaParamsSchema = schema.object({ mediaId: schema.string().uuid() });
