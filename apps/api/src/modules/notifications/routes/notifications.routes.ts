import type { HttpRouter } from "@zudojs/http";

import type { WebKit } from "../../../loaders/web.loader.js";
import { describeRoute } from "../../../utils/openapi.util.js";
import type { NotificationsController } from "../controllers/notifications.controller.js";
import {
  DeviceTokenParamsSchema,
  ListNotificationsQuerySchema,
  NotificationParamsSchema,
  RegisterDeviceTokenBodySchema,
  UpdateNotificationPreferencesBodySchema,
} from "../validators/notifications.validator.js";

const BASE_PATH = "/api/v1/notifications";
const TAG = "notifications";

export function registerNotificationsRoutes(router: HttpRouter, controller: NotificationsController, web: WebKit): void {
  const manage = web.guard.requirePermission("notifications:manage");
  router.get(BASE_PATH, controller.list, { ...manage, ...describeRoute(TAG, "List my notifications", { query: ListNotificationsQuerySchema }) });
  router.get(`${BASE_PATH}/unread-count`, controller.unreadCount, { ...manage, ...describeRoute(TAG, "Count unread notifications") });
  router.post(`${BASE_PATH}/read-all`, controller.markAllRead, { ...manage, ...describeRoute(TAG, "Mark every notification read") });
  router.get(`${BASE_PATH}/preferences`, controller.getPreferences, { ...manage, ...describeRoute(TAG, "Get notification preferences") });
  router.patch(`${BASE_PATH}/preferences`, controller.updatePreferences, { ...manage, ...describeRoute(TAG, "Update notification preferences", { body: UpdateNotificationPreferencesBodySchema }) });
  router.post(`${BASE_PATH}/device-tokens`, controller.registerDeviceToken, { ...manage, ...describeRoute(TAG, "Register a push device token", { body: RegisterDeviceTokenBodySchema }) });
  router.delete(`${BASE_PATH}/device-tokens/:token`, controller.removeDeviceToken, { ...manage, ...describeRoute(TAG, "Remove a push device token", { params: DeviceTokenParamsSchema }) });
  router.post(`${BASE_PATH}/:id/read`, controller.markRead, { ...manage, ...describeRoute(TAG, "Mark a notification read", { params: NotificationParamsSchema }) });
}
