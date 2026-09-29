import { schema, type Infer } from "@zudojs/schema";

import { MAX_PAGE_SIZE } from "../../../utils/pagination.util.js";

const productIds = schema.array(schema.string().uuid()).max(10);

export const PostMediaSchema = schema.object({
  url: schema.string().url().max(2048).optional(),
  mediaId: schema.string().uuid().optional(),
  type: schema.enum(["image", "video"]),
});

export const CreatePostBodySchema = schema.object({
  kind: schema.enum(["post", "clip", "story"]).default("post"),
  text: schema.string().max(2000).optional(),
  media: schema.array(PostMediaSchema).max(10).optional(),
  productIds: productIds.optional(),
  topics: schema.array(schema.string().min(2).max(40).regex(/^[a-z0-9-]+$/)).max(5).optional(),
  storeId: schema.string().uuid().optional(),
  repostOfId: schema.string().uuid().optional(),
});

export const TagProductsBodySchema = schema.object({ productIds: productIds.min(1) });

export const CommentBodySchema = schema.object({
  text: schema.string().min(1).max(1000),
  parentId: schema.string().uuid().optional(),
});

export const PostParamsSchema = schema.object({ id: schema.string().uuid() });

export const CommentParamsSchema = schema.object({ id: schema.string().uuid(), commentId: schema.string().uuid() });

export const PostListQuerySchema = schema.object({
  limit: schema.coerce.number().int().min(1).max(MAX_PAGE_SIZE).optional(),
  cursor: schema.string().uuid().optional(),
  kind: schema.enum(["post", "clip", "story"]).optional(),
});

export const StartLiveBodySchema = schema.object({
  title: schema.string().min(1).max(120),
  storeId: schema.string().uuid().optional(),
  productIds: productIds.optional(),
});

export const LiveCommentBodySchema = schema.object({ text: schema.string().min(1).max(500) });

export const LiveProductBodySchema = schema.object({ productId: schema.string().uuid(), pin: schema.boolean().default(false) });

export type CreatePostBody = Infer<typeof CreatePostBodySchema>;
export type StartLiveBody = Infer<typeof StartLiveBodySchema>;

export const RepostBodySchema = schema.object({ text: schema.string().max(2000).optional() });

export const PageQuerySchemaForLists = schema.object({
  limit: schema.coerce.number().int().min(1).max(MAX_PAGE_SIZE).optional(),
  cursor: schema.string().uuid().optional(),
});
