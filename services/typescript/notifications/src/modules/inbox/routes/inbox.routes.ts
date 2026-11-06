import type { Container } from "../../../container.js";
import type { RouteDefinition } from "../../../types/route.type.js";
import { InboxController } from "../controllers/inbox.controller.js";

export function createInboxRoutes(container: Container): readonly RouteDefinition[] {
  const controller = new InboxController(container);
  return [
    { method: "GET", path: "/api/v1/notifications", handler: controller.list },
    { method: "GET", path: "/api/v1/notifications/unread-count", handler: controller.unreadCount },
    { method: "POST", path: "/api/v1/notifications/read-all", handler: controller.markAllRead },
    { method: "GET", path: "/api/v1/notifications/preferences", handler: controller.listPreferences },
    { method: "PATCH", path: "/api/v1/notifications/preferences", handler: controller.updatePreference },
    { method: "POST", path: "/api/v1/notifications/device-tokens", handler: controller.registerDeviceToken },
    { method: "POST", path: "/api/v1/notifications/activity", handler: controller.recordActivity },
    { method: "DELETE", path: "/api/v1/notifications/device-tokens", handler: controller.removeDeviceToken },
    { method: "POST", path: "/api/v1/notifications/:notificationId/read", handler: controller.markRead },
  ];
}
