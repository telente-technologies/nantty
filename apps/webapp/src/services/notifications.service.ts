import type { CategorizedNotification } from "@/types/commerce.type";

import { sendRequestToWebappServer, sendListRequestToWebappServer } from "./clientApi.service";

export const notificationsService = {
  fetchMyNotifications: () => sendListRequestToWebappServer<CategorizedNotification>("/api/v1/notifications"),
  markNotificationAsRead: (notificationId: string) => sendRequestToWebappServer<void>(`/api/v1/notifications/${notificationId}/read`, { method: "POST" }),
  markAllNotificationsAsRead: () => sendRequestToWebappServer<void>("/api/v1/notifications/read-all", { method: "POST" }),
};
