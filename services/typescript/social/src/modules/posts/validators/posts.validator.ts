import { schema } from "@zudojs/schema";

import { mentionEntitiesSchema } from "../../mentions/validators/mentions.validator.js";

const mediaReferenceSchema = schema.object({
  id: schema.string().uuid(),
  type: schema.enum(["image", "video"]),
  status: schema.enum(["uploaded", "processing", "ready", "failed"]).optional(),
  url: schema.optional(schema.nullable(schema.string().max(2000))),
  posterUrl: schema.optional(schema.nullable(schema.string().max(2000))),
  hlsUrl: schema.optional(schema.nullable(schema.string().max(2000))),
  width: schema.number().int().min(1).optional(),
  height: schema.number().int().min(1).optional(),
  durationSeconds: schema.number().min(0).optional(),
  blurhash: schema.optional(schema.nullable(schema.string().max(120))),
});

const stickerLayoutSchema = schema.object({
  x: schema.number().min(0).max(1),
  y: schema.number().min(0).max(1),
  scale: schema.number().min(0.1).max(10),
  rotation: schema.number().min(-360).max(360),
  hidden: schema.boolean().optional(),
});

const replyToCommentSchema = schema.object({ commentId: schema.string().uuid(), clipId: schema.string().uuid(), commenterUserId: schema.string().uuid() });

export const createPostBodySchema = schema.object({
  text: schema.string().max(2200).optional(),
  mediaIds: schema.array(schema.string().uuid()).max(10).optional(),
  media: schema.array(mediaReferenceSchema).max(10).optional(),
  audience: schema.enum(["everyone", "followers"]).optional(),
  kind: schema.enum(["post", "clip", "story"]).optional(),
  visibility: schema.enum(["public", "subscribers"]).optional(),
  soundId: schema.string().uuid().optional(),
  isAiGenerated: schema.boolean().optional(),
  mentions: mentionEntitiesSchema.optional(),
  replyToComment: replyToCommentSchema.optional(),
  stickerLayout: stickerLayoutSchema.optional(),
});

export const publishStoryBodySchema = schema.object({ mediaId: schema.string().uuid(), media: mediaReferenceSchema });
export const postIdParamsSchema = schema.object({ postId: schema.string().uuid() });
export const storyIdParamsSchema = schema.object({ storyId: schema.string().uuid() });
export const userIdParamsSchema = schema.object({ userId: schema.string().min(1).max(64) });
export const repostBodySchema = schema.object({ text: schema.string().max(2200).optional() });
export const shareBodySchema = schema.object({ channel: schema.string().max(30).optional() });
export const userPostsQuerySchema = schema.object({
  cursor: schema.string().uuid().optional(),
  limit: schema.coerce.number().int().min(1).max(100).optional(),
  kind: schema.enum(["post", "clip"]).optional(),
});
