import { schema } from "@nantty/fastify-platform";

import { maximumPageSize, maximumQueryLength, maximumScopeLength } from "../../../constants/search.constant.js";
import { searchTypes } from "../../../enums/searchType.enum.js";

export const searchQuerySchema = schema.object({
  q: schema.string().min(1).max(maximumQueryLength),
  scope: schema.string().max(maximumScopeLength).optional(),
  type: schema.enum(searchTypes).optional(),
  cursor: schema.string().max(300).optional(),
  limit: schema.coerce.number().int().min(1).max(maximumPageSize).optional(),
});

export const suggestQuerySchema = schema.object({ q: schema.string().min(1).max(maximumQueryLength) });
