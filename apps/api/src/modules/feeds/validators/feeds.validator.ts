import { schema } from "@zudojs/schema";

import { MAX_PAGE_SIZE } from "../../../utils/pagination.util.js";

export const FeedQuerySchema = schema.object({
  limit: schema.coerce.number().int().min(1).max(MAX_PAGE_SIZE).optional(),
  cursor: schema.string().uuid().optional(),
  topicId: schema.string().uuid().optional(),
});

export const ClipsQuerySchema = schema.object({
  limit: schema.coerce.number().int().min(1).max(MAX_PAGE_SIZE).optional(),
  cursor: schema.string().uuid().optional(),
  tab: schema.enum(["forYou", "following"]).optional(),
});

export const FeedInteractionBodySchema = schema.object({
  postId: schema.string().uuid(),
  kind: schema.enum(["view", "click", "share", "dwell"]),
});
