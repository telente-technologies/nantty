import { sendRequestToStudioServer } from "./clientApi.service";

export const notificationsService = {
  fetchUnreadCount: async () => (await sendRequestToStudioServer<{ readonly count: number }>("/api/v1/notifications/unread-count")).count,
};
