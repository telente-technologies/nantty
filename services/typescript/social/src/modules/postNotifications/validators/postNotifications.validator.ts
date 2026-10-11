import { schema } from "@zudojs/schema";

import { postNotificationLevels } from "../models/postNotifications.model.js";

export const targetParamsSchema = schema.object({ userId: schema.string().min(1).max(64) });
export const setPostNotificationsBodySchema = schema.object({ level: schema.enum(postNotificationLevels) });
export const subscriberParamsSchema = schema.object({ accountId: schema.string().uuid() });
export const subscriberQuerySchema = schema.object({
  scope: schema.enum(["posts", "lives"]),
  cursor: schema.string().uuid().optional(),
  postId: schema.string().uuid().optional(),
  limit: schema.coerce.number().int().min(1).max(500).optional(),
});
