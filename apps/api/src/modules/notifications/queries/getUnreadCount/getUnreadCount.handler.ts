import { QueryHandler } from "@zudojs/cqrs";

import type { UnreadNotificationCounts } from "../../models/notifications.model.js";
import type { NotificationsService } from "../../services/notifications.service.js";
import type { GetUnreadCountQuery } from "./getUnreadCount.query.js";

export class GetUnreadCountHandler extends QueryHandler<GetUnreadCountQuery, UnreadNotificationCounts> {
  public readonly queryType = "notifications.getUnreadCount" as const;

  public constructor(private readonly notificationsService: NotificationsService) {
    super();
  }

  public execute(query: GetUnreadCountQuery): Promise<UnreadNotificationCounts> {
    return this.notificationsService.dependencies.notifications.countUnreadForUser(query.principal.userId);
  }
}
