import { CommandHandler } from "@zudojs/cqrs";

import type { NotificationRecord } from "../../models/notifications.model.js";
import type { NotificationsService } from "../../services/notifications.service.js";
import type { SendNotificationCommand } from "./sendNotification.command.js";

export class SendNotificationHandler extends CommandHandler<SendNotificationCommand, NotificationRecord | undefined> {
  public readonly commandType = "notifications.sendNotification" as const;

  public constructor(private readonly notificationsService: NotificationsService) {
    super();
  }

  public execute(command: SendNotificationCommand): Promise<NotificationRecord | undefined> {
    return this.notificationsService.deliverRequestedNotification(command.request);
  }
}
