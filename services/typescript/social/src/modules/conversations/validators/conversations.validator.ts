import { schema } from "@zudojs/schema";

export const conversationParamsSchema = schema.object({ conversationId: schema.string().uuid() });
export const memberParamsSchema = schema.object({ conversationId: schema.string().uuid(), userId: schema.string().uuid() });
export const listConversationsQuerySchema = schema.object({
  folder: schema.enum(["chats", "requests", "spam"]).optional(),
  filter: schema.enum(["all", "direct"]).optional(),
  cursor: schema.string().uuid().optional(),
  limit: schema.coerce.number().int().min(1).max(100).optional(),
});
export const searchQuerySchema = schema.object({ q: schema.string().min(1).max(100) });
export const startConversationBodySchema = schema.object({ userId: schema.string().uuid() });
export const createGroupBodySchema = schema.object({
  name: schema.string().min(1).max(80),
  photoMediaId: schema.string().uuid().optional(),
  memberIds: schema.array(schema.string().uuid()).max(255),
});
export const updateConversationBodySchema = schema.object({
  name: schema.string().min(1).max(80).optional(),
  photoMediaId: schema.string().uuid().optional(),
  disappearingMessagesSeconds: schema.optional(schema.nullable(schema.number().int().min(0).max(31_536_000))),
  onlyAdminsCanMentionAll: schema.boolean().optional(),
});
export const addMembersBodySchema = schema.object({ userIds: schema.array(schema.string().uuid()).min(1).max(100) });
export const adminBodySchema = schema.object({ userId: schema.string().uuid() });
export const muteBodySchema = schema.object({ duration: schema.enum(["8h", "1w", "always", "off"]) });
