import { schema } from "@zudojs/schema";

export const userIdParamsSchema = schema.object({ userId: schema.string().min(1).max(64) });
export const followRequestParamsSchema = schema.object({ requestId: schema.string().uuid() });
export const connectionListQuerySchema = schema.object({
  q: schema.string().max(100).optional(),
  type: schema.enum(["user", "store"]).optional(),
  cursor: schema.string().uuid().optional(),
  limit: schema.coerce.number().int().min(1).max(100).optional(),
});
export const pageQuerySchema = schema.object({
  cursor: schema.string().uuid().optional(),
  limit: schema.coerce.number().int().min(1).max(100).optional(),
});
export const connectionsQuerySchema = schema.object({
  tab: schema.enum(["followers", "following", "shopped", "suggested", "blocked"]),
  q: schema.string().max(100).optional(),
  cursor: schema.string().uuid().optional(),
  limit: schema.coerce.number().int().min(1).max(100).optional(),
});
