import { schema, type Infer } from "@zudojs/schema";

import { MAX_PAGE_SIZE } from "../../../utils/pagination.util.js";
import { DISPLAY_NOTIFICATION_CATEGORIES, NOTIFICATION_CATEGORY_VALUES } from "../models/notifications.model.js";

export const ListNotificationsQuerySchema = schema.object({
  limit: schema.coerce.number().int().min(1).max(MAX_PAGE_SIZE).optional(),
  cursor: schema.string().uuid().optional(),
  category: schema.enum([...DISPLAY_NOTIFICATION_CATEGORIES]).optional(),
  unreadOnly: schema.coerce.boolean().optional(),
});

export const NotificationParamsSchema = schema.object({ id: schema.string().uuid() });

export const RegisterDeviceTokenBodySchema = schema.object({
  token: schema.string().min(10).max(4096),
  platform: schema.enum(["ios", "android", "web"]),
});

export const DeviceTokenParamsSchema = schema.object({ token: schema.string().min(10).max(4096) });

export type ListNotificationsQueryInput = Infer<typeof ListNotificationsQuerySchema>;

export const UpdateNotificationPreferencesBodySchema = schema.object(
  Object.fromEntries(NOTIFICATION_CATEGORY_VALUES.map((category) => [category, schema.boolean()])) as Record<
    (typeof NOTIFICATION_CATEGORY_VALUES)[number],
    ReturnType<typeof schema.boolean>
  >,
).partial();
