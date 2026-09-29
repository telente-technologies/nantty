import { schema } from "@zudojs/schema";

import { MAX_PAGE_SIZE } from "../../../utils/pagination.util.js";

export const TargetParamsSchema = schema.object({ id: schema.string().uuid() });

export const FollowListQuerySchema = schema.object({
  limit: schema.coerce.number().int().min(1).max(MAX_PAGE_SIZE).optional(),
  cursor: schema.string().uuid().optional(),
  type: schema.enum(["user", "store"]).optional(),
});

export const ConnectionsQuerySchema = schema.object({
  tab: schema.enum(["followers", "following", "shopped", "suggested", "blocked"]).optional(),
  limit: schema.coerce.number().int().min(1).max(MAX_PAGE_SIZE).optional(),
  cursor: schema.string().uuid().optional(),
});

export const SearchPeopleQuerySchema = schema.object({ q: schema.string().min(1).max(100) });
