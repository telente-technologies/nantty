import type { NotificationRepository } from "../../../../interfaces/repositories.interface.js";
import { convertNotificationToResponse, type NotificationResponse } from "../../dtos/notification.dto.js";
import type { ListNotificationsQuery } from "./listNotifications.query.js";

export class ListNotificationsHandler {
  public constructor(private readonly notifications: NotificationRepository, private readonly webBaseUrl?: string) {}

  public async execute(query: ListNotificationsQuery): Promise<{ readonly data: readonly NotificationResponse[]; readonly nextCursor: string | null }> {
    const page = await this.notifications.list(query.userId, query.filter, query.limit, query.cursor);
    return { data: page.rows.map((row) => convertNotificationToResponse(row, this.webBaseUrl)), nextCursor: page.nextCursor };
  }
}
