import { schema, type Infer } from "@zudojs/schema";

import { MAX_PAGE_SIZE } from "../../../utils/pagination.util.js";

const MAXIMUM_DISAPPEARING_SECONDS = 90 * 86_400;
const MAXIMUM_VOICE_NOTE_SECONDS = 15 * 60;

export const StartConversationBodySchema = schema.object({ userId: schema.string().uuid() });

export const ConversationParamsSchema = schema.object({ id: schema.string().uuid() });

export const ConversationMemberParamsSchema = schema.object({ id: schema.string().uuid(), userId: schema.string().uuid() });

export const MessageParamsSchema = schema.object({ messageId: schema.string().uuid() });

export const MessageReactionParamsSchema = schema.object({ messageId: schema.string().uuid(), emoji: schema.string().min(1).max(16) });

export const ConversationMessageParamsSchema = schema.object({ id: schema.string().uuid(), messageId: schema.string().uuid() });

export const StoreParamsSchema = schema.object({ storeId: schema.string().uuid() });

export const ListConversationsQuerySchema = schema.object({
  filter: schema.enum(["all", "direct", "groups", "channels", "business"]).optional(),
  q: schema.string().max(80).optional(),
});

export const SendMessageBodySchema = schema.object({
  text: schema.string().max(2000).optional(),
  kind: schema.enum(["text", "voice"]).optional(),
  mediaId: schema.string().uuid().optional(),
  durationSeconds: schema.coerce.number().int().min(1).max(MAXIMUM_VOICE_NOTE_SECONDS).optional(),
  media: schema.array(schema.object({ url: schema.string().url().max(2048), type: schema.enum(["image", "video"]) })).max(4).optional(),
});

export const ListMessagesQuerySchema = schema.object({
  limit: schema.coerce.number().int().min(1).max(MAX_PAGE_SIZE).optional(),
  cursor: schema.string().uuid().optional(),
  after: schema.string().max(120).optional(),
});

export const SearchMessagesQuerySchema = schema.object({ q: schema.string().min(1).max(80) });

export const CreateGroupBodySchema = schema.object({
  name: schema.string().min(1).max(80),
  photoMediaId: schema.string().uuid().optional(),
  memberIds: schema.array(schema.string().uuid()).min(1).max(255),
});

export const CreateChannelBodySchema = schema.object({
  name: schema.string().min(1).max(80),
  description: schema.string().max(500).optional(),
  photoMediaId: schema.string().uuid().optional(),
});

export const UpdateConversationBodySchema = schema.object({
  name: schema.string().min(1).max(80).optional(),
  photoMediaId: schema.string().uuid().optional(),
  disappearingMessagesSeconds: schema.optional(schema.nullable(schema.number().int().min(60).max(MAXIMUM_DISAPPEARING_SECONDS))),
});

export const AddMembersBodySchema = schema.object({ userIds: schema.array(schema.string().uuid()).min(1).max(100) });

export const PromoteAdminBodySchema = schema.object({ userId: schema.string().uuid() });

export const ReactionBodySchema = schema.object({ emoji: schema.string().min(1).max(16) });

export const StoreConversationsQuerySchema = schema.object({ storeId: schema.string().uuid().optional() });

export type SendMessageBody = Infer<typeof SendMessageBodySchema>;
export type CreateGroupBody = Infer<typeof CreateGroupBodySchema>;
export type CreateChannelBody = Infer<typeof CreateChannelBodySchema>;
export type UpdateConversationBody = Infer<typeof UpdateConversationBodySchema>;
export type ConversationListFilter = NonNullable<Infer<typeof ListConversationsQuerySchema>["filter"]>;
