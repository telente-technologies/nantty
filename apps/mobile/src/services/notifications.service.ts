import type { CategorizedNotification } from "@/types/commerce.type";

import { api } from "./apiClient.service";

export const notificationsService = {
  fetchMyNotifications: () => api.get<CategorizedNotification[]>("/api/v1/notifications"),
  markNotificationAsRead: (notificationId: string) => api.post<void>(`/api/v1/notifications/${notificationId}/read`),
  markAllNotificationsAsRead: () => api.post<void>("/api/v1/notifications/read-all"),
};
