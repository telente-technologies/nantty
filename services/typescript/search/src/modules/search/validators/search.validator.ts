import { schema } from "@zudojs/schema";

import { maximumPageSize, maximumQueryLength } from "../../../constants/search.constant.js";
import { searchScopes } from "../../../enums/searchScope.enum.js";

export const searchQuerySchema = schema.object({
  q: schema.string().min(1).max(maximumQueryLength),
  scope: schema.enum(searchScopes).optional(),
  cursor: schema.string().max(300).optional(),
  limit: schema.coerce.number().int().min(1).max(maximumPageSize).optional(),
});

export const suggestQuerySchema = schema.object({ q: schema.string().min(1).max(maximumQueryLength) });
