import type { CategorizedNotification } from "@/types/commerce.type";
import type { NotificationPreference } from "@/types/notificationPreference.type";

import { sendRequestToWebappServer, sendListRequestToWebappServer } from "./clientApi.service";

export const notificationsService = {
  fetchMyNotifications: () => sendListRequestToWebappServer<CategorizedNotification>("/api/v1/notifications"),
  markNotificationAsRead: (notificationId: string) => sendRequestToWebappServer<void>(`/api/v1/notifications/${notificationId}/read`, { method: "POST" }),
  listPreferences: () => sendListRequestToWebappServer<NotificationPreference>("/api/v1/notifications/preferences"),
  updatePreference: (category: string, update: { push?: boolean; email?: boolean }) =>
    sendRequestToWebappServer<NotificationPreference>("/api/v1/notifications/preferences", { method: "PATCH", body: { category, ...update } }),
  markAllNotificationsAsRead: () => sendRequestToWebappServer<void>("/api/v1/notifications/read-all", { method: "POST" }),
};
