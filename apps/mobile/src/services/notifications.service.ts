import type { CategorizedNotification } from "@/types/commerce.type";

import { api } from "./apiClient.service";

export const notificationsService = {
  fetchMyNotifications: (filter: "all" | "mentions" = "all") => api.getList<CategorizedNotification>("/api/v1/notifications", { filter }),
  markNotificationAsRead: (notificationId: string) => api.post<void>(`/api/v1/notifications/${notificationId}/read`),
  markAllNotificationsAsRead: () => api.post<void>("/api/v1/notifications/read-all"),
};
