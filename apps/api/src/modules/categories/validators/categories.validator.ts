import { schema, type Infer } from "@zudojs/schema";

export const CreateCategoryBodySchema = schema.object({
  name: schema.string().min(2).max(80),
  slug: schema.string().min(2).max(80).regex(/^[a-z0-9-]+$/).optional(),
  parentId: schema.optional(schema.nullable(schema.string().uuid())),
  imageUrl: schema.optional(schema.nullable(schema.string().url().max(2048))),
  sortOrder: schema.number().int().min(0).max(10_000).optional(),
});

export const UpdateCategoryBodySchema = CreateCategoryBodySchema.partial();

export const CategoryParamsSchema = schema.object({ id: schema.string().uuid() });

export type CreateCategoryBody = Infer<typeof CreateCategoryBodySchema>;
export type UpdateCategoryBody = Infer<typeof UpdateCategoryBodySchema>;
