import { schema } from "@zudojs/schema";

import { maximumShareConversations } from "../../../constants/social.constant.js";
import { mentionEntitiesSchema } from "../../mentions/validators/mentions.validator.js";

const kindSchema = schema.enum(["text", "voice", "image", "video", "shared", "location", "liveLocation", "document", "poll"]);
const referenceKinds = schema.enum(["post", "clip", "story", "product", "live", "store", "profile"]);
const referenceSchema = schema.object({ kind: referenceKinds, id: schema.string().min(1).max(100) });

export const sendMessageBodySchema = schema.object({
  kind: kindSchema.optional(),
  text: schema.string().max(1000).optional(),
  encryption: schema.object({ deviceId: schema.string().min(1).max(100), ciphertext: schema.string().min(1).max(70000), protocol: schema.string().max(40).optional() }).optional(),
  mediaId: schema.string().uuid().optional(),
  mediaUrl: schema.optional(schema.nullable(schema.string().max(2000))),
  durationSeconds: schema.number().min(0).max(36000).optional(),
  linkPreview: schema.optional(schema.nullable(schema.string().max(8192))),
  sharedContent: referenceSchema.optional(),
  location: schema.object({
    latitude: schema.number(), longitude: schema.number(),
    address: schema.optional(schema.nullable(schema.string().max(200))), liveUntil: schema.optional(schema.nullable(schema.string().max(40))),
  }).optional(),
  document: schema.object({
    fileName: schema.string().min(1).max(300), mimeType: schema.string().min(1).max(120), sizeBytes: schema.number().int().min(1),
    pageCount: schema.optional(schema.nullable(schema.number().int().min(0))), url: schema.optional(schema.nullable(schema.string().max(2000))),
  }).optional(),
  poll: schema.object({ question: schema.string().min(1).max(300), allowMultipleAnswers: schema.boolean(), options: schema.array(schema.string().min(1).max(100)).min(2).max(6) }).optional(),
  mentions: mentionEntitiesSchema.optional(),
});

export const conversationMessagesParamsSchema = schema.object({ conversationId: schema.string().uuid() });
export const messageParamsSchema = schema.object({ messageId: schema.string().uuid() });
export const reactionParamsSchema = schema.object({ messageId: schema.string().uuid(), emoji: schema.string().min(1).max(32) });
export const listMessagesQuerySchema = schema.object({ cursor: schema.string().uuid().optional(), after: schema.string().uuid().optional(), limit: schema.coerce.number().int().min(1).max(100).optional() });
export const reactionBodySchema = schema.object({ emoji: schema.string().min(1).max(32) });
export const locationBodySchema = schema.object({ latitude: schema.number(), longitude: schema.number(), address: schema.optional(schema.nullable(schema.string().max(200))) });
export const pollVoteBodySchema = schema.object({ optionId: schema.string().uuid() });
export const shareBodySchema = schema.object({
  conversationIds: schema.array(schema.string().uuid()).min(1).max(maximumShareConversations),
  reference: referenceSchema,
  note: schema.string().max(0).optional(),
  encryptions: schema.array(schema.object({ conversationId: schema.string().uuid(), deviceId: schema.string().min(1).max(100), ciphertext: schema.string().min(1).max(70000) })).max(maximumShareConversations).optional(),
});
export const contentQuerySchema = schema.object({ kind: referenceKinds, id: schema.string().min(1).max(100) });
export const storyReplyParamsSchema = schema.object({ storyId: schema.string().uuid() });
export const storyReplyBodySchema = schema.object({ encryption: schema.object({ deviceId: schema.string().min(1).max(100), ciphertext: schema.string().min(1).max(70000), protocol: schema.string().max(40).optional() }) });
