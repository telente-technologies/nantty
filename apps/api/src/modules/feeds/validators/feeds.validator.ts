import { schema, type Infer } from "@zudojs/schema";

import { MAX_PAGE_SIZE } from "../../../utils/pagination.util.js";

const SURFACE_PATTERN = /^[a-z_]{1,40}$/;
const REQUEST_ID_PATTERN = /^[A-Za-z0-9_\-:.]{1,128}$/;

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
  postId: schema.string().uuid().optional(),
  productId: schema.string().uuid().optional(),
  kind: schema.enum(["view", "click", "share", "dwell", "watch", "product_view", "add_to_cart"]),
  dwellMs: schema.number().int().min(0).max(3_600_000).optional(),
  watchFraction: schema.number().min(0).max(1).optional(),
  loopCount: schema.number().int().min(0).max(100).optional(),
  durationMs: schema.number().int().min(0).max(3_600_000).optional(),
  position: schema.number().int().min(0).max(10_000).optional(),
  quantity: schema.number().int().min(1).max(10_000).optional(),
  sourcePostId: schema.string().uuid().optional(),
  surface: schema.string().regex(SURFACE_PATTERN).optional(),
  rankingRequestId: schema.string().regex(REQUEST_ID_PATTERN).optional(),
  deviceClass: schema.enum(["android", "ios", "web", "other"]).optional(),
});

export type FeedInteractionBody = Infer<typeof FeedInteractionBodySchema>;

export const FeedFeedbackBodySchema = schema.object({
  postId: schema.string().uuid(),
  type: schema.enum(["hide", "not_interested"]),
});

export const TrendingQuerySchema = schema.object({
  kind: schema.enum(["hashtag", "topic", "post", "clip"]).optional(),
  limit: schema.coerce.number().int().min(1).max(50).optional(),
});
