import { schema } from "@nantty/fastify-platform";

import { mentionEntitiesSchema } from "../../mentions/validators/mentions.validator.js";

export const postCommentsParamsSchema = schema.object({ postId: schema.string().uuid() });
export const commentParamsSchema = schema.object({ commentId: schema.string().uuid() });
export const postCommentParamsSchema = schema.object({ postId: schema.string().uuid(), commentId: schema.string().uuid() });
export const commentsPageQuerySchema = schema.object({ cursor: schema.string().uuid().optional(), limit: schema.coerce.number().int().min(1).max(50).optional() });
const conversationFilterSchema = schema.enum(["all", "quotes"]).optional();
export const rankedCommentsQuerySchema = schema.object({ filter: conversationFilterSchema, cursor: schema.string().max(300).optional(), limit: schema.coerce.number().int().min(1).max(50).optional() });
export const newCommentBodySchema = schema.object({
  text: schema.string().min(1).max(1500),
  parentCommentId: schema.string().uuid().optional(),
  asProfileId: schema.string().uuid().optional(),
  mentions: mentionEntitiesSchema.optional(),
  quotedPostId: schema.optional(schema.nullable(schema.string().uuid())),
});
export const myPostCommentsQuerySchema = schema.object({
  filter: schema.enum(["all", "needs_reply", "pinned", "hidden"]).optional(),
  postId: schema.string().uuid().optional(),
  q: schema.string().trim().min(1).max(100).optional(),
  cursor: schema.string().uuid().optional(),
  limit: schema.coerce.number().int().min(1).max(50).optional(),
});
export const conversationQuerySchema = schema.object({
  sort: schema.enum(["relevant", "latest", "likes", "top"]).optional(),
  filter: conversationFilterSchema,
  cursor: schema.string().max(300).optional(),
  limit: schema.coerce.number().int().min(1).max(50).optional(),
});
