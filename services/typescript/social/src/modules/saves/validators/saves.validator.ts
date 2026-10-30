import { schema } from "@nantty/fastify-platform";

const savedItemTypeSchema = schema.enum(["post", "video", "clip", "product", "comment"]);

export const saveBodySchema = schema.object({ type: savedItemTypeSchema, targetId: schema.string().min(1).max(100), collectionId: schema.string().uuid().optional() });
export const unsaveQuerySchema = schema.object({ type: savedItemTypeSchema.optional(), targetId: schema.string().min(1).max(100) });
export const listSavesQuerySchema = schema.object({
  type: schema.enum(["all", "post", "video", "clip", "product", "comment"]).optional(),
  collectionId: schema.string().uuid().optional(),
  cursor: schema.string().uuid().optional(),
});
export const collectionBodySchema = schema.object({ name: schema.string().min(1).max(40) });
export const saveIdParamsSchema = schema.object({ saveId: schema.string().uuid() });
export const moveSaveBodySchema = schema.object({ collectionId: schema.nullable(schema.string().uuid()) });
