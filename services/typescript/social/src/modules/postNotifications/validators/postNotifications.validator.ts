import { schema } from "@nantty/fastify-platform";

import { postNotificationLevels } from "../models/postNotifications.model.js";
import { accountIdOrMeParam } from "../../../utils/accountParam.util.js";

export const targetParamsSchema = schema.object({ userId: accountIdOrMeParam });
export const setPostNotificationsBodySchema = schema.object({ level: schema.enum(postNotificationLevels) });
export const subscriberParamsSchema = schema.object({ accountId: schema.string().uuid() });
export const subscriberQuerySchema = schema.object({
  scope: schema.enum(["posts", "lives"]),
  cursor: schema.string().uuid().optional(),
  postId: schema.string().uuid().optional(),
  limit: schema.coerce.number().int().min(1).max(500).optional(),
});
