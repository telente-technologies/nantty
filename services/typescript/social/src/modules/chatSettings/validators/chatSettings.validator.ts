import { schema } from "@nantty/fastify-platform";

export const updateChatSettingsBodySchema = schema.object({
  messageRequestsFrom: schema.enum(["everyone", "following", "followers", "nobody"]).optional(),
  preventDirectGroupAdds: schema.boolean().optional(),
  notifications: schema.object({
    messages: schema.boolean().optional(),
    requests: schema.boolean().optional(),
    groups: schema.boolean().optional(),
    streakReminders: schema.boolean().optional(),
    showMessagePreview: schema.boolean().optional(),
    sound: schema.boolean().optional(),
    vibration: schema.boolean().optional(),
    bubbles: schema.boolean().optional(),
    bubbleMode: schema.enum(["all", "selected"]).optional(),
    bubbleConversationIds: schema.array(schema.string().uuid()).max(1000).optional(),
    bubbleExcludedConversationIds: schema.array(schema.string().uuid()).max(1000).optional(),
  }).optional(),
  timezone: schema.string().min(1).max(64).optional(),
});
