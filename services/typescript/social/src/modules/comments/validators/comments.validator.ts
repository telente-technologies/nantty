import { schema } from "@zudojs/schema";

import { mentionEntitiesSchema } from "../../mentions/validators/mentions.validator.js";

export const postCommentsParamsSchema = schema.object({ postId: schema.string().uuid() });
export const commentParamsSchema = schema.object({ commentId: schema.string().uuid() });
export const commentsPageQuerySchema = schema.object({ cursor: schema.string().uuid().optional(), limit: schema.coerce.number().int().min(1).max(50).optional() });
export const newCommentBodySchema = schema.object({
  text: schema.string().min(1).max(1500),
  parentCommentId: schema.string().uuid().optional(),
  mentions: mentionEntitiesSchema.optional(),
});
