import { QueryHandler } from "@zudojs/cqrs";

import type { Page } from "../../../../types/pagination.type.js";
import type { NotificationRecord } from "../../models/notifications.model.js";
import type { NotificationsService } from "../../services/notifications.service.js";
import type { ListNotificationsQuery } from "./listNotifications.query.js";

export class ListNotificationsHandler extends QueryHandler<ListNotificationsQuery, Page<NotificationRecord>> {
  public readonly queryType = "notifications.listNotifications" as const;

  public constructor(private readonly notificationsService: NotificationsService) {
    super();
  }

  public execute(query: ListNotificationsQuery): Promise<Page<NotificationRecord>> {
    return this.notificationsService.dependencies.notifications.listForUser(query.principal.userId, query.filter, query.page);
  }
}
