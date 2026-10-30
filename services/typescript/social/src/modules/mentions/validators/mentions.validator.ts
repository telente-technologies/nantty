import { schema } from "@nantty/fastify-platform";

const userMentionSchema = schema.object({
  userId: schema.string().uuid(),
  username: schema.string().min(1).max(30),
  start: schema.number().int().min(0),
  length: schema.number().int().min(2),
});

const allMentionSchema = schema.object({
  type: schema.literal("all"),
  start: schema.number().int().min(0),
  length: schema.number().int().min(2),
});

export const mentionEntitySchema = schema.union([allMentionSchema, userMentionSchema]);
export const mentionEntitiesSchema = schema.array(mentionEntitySchema).max(100);

export const candidatesQuerySchema = schema.object({
  surface: schema.enum(["post", "comment", "group", "direct"]),
  q: schema.string().max(50).optional(),
  conversationId: schema.string().uuid().optional(),
});

export const resolveBodySchema = schema.object({ userIds: schema.array(schema.string().min(1).max(64)).min(1).max(100) });
