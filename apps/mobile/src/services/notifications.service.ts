import type { CategorizedNotification } from "@/types/commerce.type";
import type { NotificationPreference } from "@/types/notificationPreference.type";

import { api } from "./apiClient.service";

export const notificationsService = {
  fetchMyNotifications: (filter: "all" | "mentions" = "all") => api.getList<CategorizedNotification>("/api/v1/notifications", { filter }),
  markNotificationAsRead: (notificationId: string) => api.post<void>(`/api/v1/notifications/${notificationId}/read`),
  listPreferences: () => api.getList<NotificationPreference>("/api/v1/notifications/preferences"),
  updatePreference: (category: string, update: { push?: boolean; email?: boolean }) =>
    api.patch<NotificationPreference>("/api/v1/notifications/preferences", { category, ...update }),
  markAllNotificationsAsRead: () => api.post<void>("/api/v1/notifications/read-all"),
};
