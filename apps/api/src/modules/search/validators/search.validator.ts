import { schema, type Infer } from "@zudojs/schema";

export const SearchQuerySchema = schema.object({
  q: schema.string().min(1).max(100),
  scope: schema.enum(["products", "stores", "people", "all"]).optional(),
  limit: schema.coerce.number().int().min(1).max(50).optional(),
});

export type SearchQueryInput = Infer<typeof SearchQuerySchema>;
