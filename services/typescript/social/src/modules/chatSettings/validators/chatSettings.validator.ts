import { schema } from "@nantty/fastify-platform";

export const updateChatSettingsBodySchema = schema.object({
  messageRequestsFrom: schema.enum(["everyone", "following", "followers", "nobody"]).optional(),
  notifications: schema.object({
    messages: schema.boolean().optional(),
    requests: schema.boolean().optional(),
    groups: schema.boolean().optional(),
    streakReminders: schema.boolean().optional(),
    showMessagePreview: schema.boolean().optional(),
  }).optional(),
  timezone: schema.string().min(1).max(64).optional(),
});
