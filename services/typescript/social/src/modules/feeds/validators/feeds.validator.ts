import { schema } from "@zudojs/schema";

export const feedQuerySchema = schema.object({
  cursor: schema.string().max(200).optional(),
  limit: schema.coerce.number().int().min(1).max(50).optional(),
  topicId: schema.string().max(64).optional(),
});
export const followingFeedQuerySchema = schema.object({ cursor: schema.string().uuid().optional(), limit: schema.coerce.number().int().min(1).max(50).optional() });
export const clipsQuerySchema = schema.object({
  tab: schema.enum(["forYou", "following"]).optional(),
  cursor: schema.string().max(200).optional(),
  limit: schema.coerce.number().int().min(1).max(50).optional(),
});
export const feedbackBodySchema = schema.object({ postId: schema.string().uuid(), kind: schema.enum(["notInterested", "hide", "like", "more", "less"]) });
