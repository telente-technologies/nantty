import { schema } from "@nantty/fastify-platform";

export const storeIdParamsSchema = schema.object({ storeId: schema.string().uuid() });
export const storeFollowersQuerySchema = schema.object({ cursor: schema.string().uuid().optional(), limit: schema.coerce.number().int().min(1).max(100).optional() });
export const followStatsQuerySchema = schema.object({ viewerId: schema.string().uuid().optional() });
