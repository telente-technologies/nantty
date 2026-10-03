import type { NotificationRepository } from "../../../../interfaces/repositories.interface.js";
import type { GetUnreadCountQuery } from "./getUnreadCount.query.js";

export class GetUnreadCountHandler {
  public constructor(private readonly notifications: NotificationRepository) {}

  public async execute(query: GetUnreadCountQuery): Promise<{ readonly count: number }> {
    return { count: await this.notifications.countUnread(query.userId) };
  }
}
