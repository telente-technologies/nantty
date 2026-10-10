import { schema } from "@zudojs/schema";

import { mentionEntitiesSchema } from "../../mentions/validators/mentions.validator.js";

const mediaReferenceSchema = schema.object({
  id: schema.string().uuid().optional(),
  mediaId: schema.string().uuid().optional(),
  type: schema.enum(["image", "video"]).optional(),
  trim: schema.object({ startMs: schema.number().int().min(0).max(3_600_000), endMs: schema.number().int().min(1).max(3_600_000) }).optional(),
});

const slideshowSchema = schema.object({
  durationsMs: schema.array(schema.number().int().min(500).max(60_000)).min(1).max(10),
  transition: schema.enum(["none", "crossfade", "slide"]),
});

const locationTagSchema = schema.object({
  placeId: schema.string().min(1).max(200),
  name: schema.string().min(1).max(120),
  area: schema.optional(schema.nullable(schema.string().max(120))),
});

const topicSlugsSchema = schema.array(schema.string().min(2).max(40).regex(/^[a-z0-9-]+$/)).max(5);
const productIdsSchema = schema.array(schema.string().uuid()).max(10);

const stickerLayoutSchema = schema.object({
  x: schema.number().min(0).max(1),
  y: schema.number().min(0).max(1),
  scale: schema.number().min(0.1).max(10),
  rotation: schema.number().min(-360).max(360),
  hidden: schema.boolean().optional(),
});

const replyPolicySchema = schema.enum(["everyone", "following", "followers", "mentioned", "off"]);
const sensitiveLabelSchema = schema.enum(["nudity", "graphic_violence", "dangerous_acts", "self_harm"]);

const taggedUserIdsSchema = schema.array(schema.string().uuid()).max(40);

const replyToCommentSchema = schema.object({ commentId: schema.string().uuid(), clipId: schema.string().uuid(), commenterUserId: schema.string().uuid() });

export const createPostBodySchema = schema.object({
  text: schema.string().max(2200).optional(),
  mediaIds: schema.array(schema.string().uuid()).max(10).optional(),
  media: schema.array(mediaReferenceSchema).max(10).optional(),
  audience: schema.enum(["everyone", "followers"]).optional(),
  kind: schema.enum(["post", "clip", "story"]).optional(),
  asProfileId: schema.string().uuid().optional(),
  visibility: schema.enum(["public", "subscribers"]).optional(),
  soundId: schema.string().uuid().optional(),
  look: schema.string().min(1).max(24).optional(),
  isAiGenerated: schema.boolean().optional(),
  mentions: mentionEntitiesSchema.optional(),
  replyToComment: replyToCommentSchema.optional(),
  stickerLayout: stickerLayoutSchema.optional(),
  replyPolicy: replyPolicySchema.optional(),
  sensitiveLabels: schema.array(sensitiveLabelSchema).max(4).optional(),
  taggedUserIds: taggedUserIdsSchema.optional(),
  slideshow: slideshowSchema.optional(),
  location: locationTagSchema.optional(),
  topics: topicSlugsSchema.optional(),
  productIds: productIdsSchema.optional(),
  quotedPostId: schema.optional(schema.nullable(schema.string().uuid())),
});

export const tagProductsBodySchema = schema.object({ productIds: productIdsSchema });
export const setPostTagsBodySchema = schema.object({ taggedUserIds: taggedUserIdsSchema });
export const taggingSettingsBodySchema = schema.object({ allowTagging: schema.boolean() });
export const taggedUsersQuerySchema = schema.object({ cursor: schema.string().uuid().optional(), limit: schema.coerce.number().int().min(1).max(50).optional() });

export const replySettingsBodySchema = schema.object({ replyPolicy: replyPolicySchema });
export const sensitiveLabelsBodySchema = schema.object({ sensitiveLabels: schema.array(sensitiveLabelSchema).max(4) });
export const quotesQuerySchema = schema.object({ cursor: schema.string().uuid().optional(), limit: schema.coerce.number().int().min(1).max(50).optional() });

export const publishStoryBodySchema = schema.object({ mediaId: schema.string().uuid(), soundId: schema.string().uuid().optional(), look: schema.string().min(1).max(24).optional() });
export const postIdParamsSchema = schema.object({ postId: schema.string().uuid() });
export const storyIdParamsSchema = schema.object({ storyId: schema.string().uuid() });
export const storyViewersQuerySchema = schema.object({
  cursor: schema.string().max(100).optional(),
  limit: schema.coerce.number().int().min(1).max(50).optional(),
});
export const userIdParamsSchema = schema.object({ userId: schema.string().min(1).max(64) });
export const repostBodySchema = schema.object({ text: schema.string().max(2200).optional() });
export const shareBodySchema = schema.object({ channel: schema.string().max(30).optional() });
export const userPostsQuerySchema = schema.object({
  cursor: schema.string().uuid().optional(),
  limit: schema.coerce.number().int().min(1).max(100).optional(),
  kind: schema.enum(["post", "clip"]).optional(),
});
export const tagCandidatesQuerySchema = schema.object({ q: schema.string().min(1).max(60), cursor: schema.string().max(100).optional(), limit: schema.coerce.number().int().min(1).max(50).optional() });
