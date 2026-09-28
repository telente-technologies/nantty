import { CommandHandler } from "@zudojs/cqrs";

import { notFound } from "../../../../errors/domain.error.js";
import type { NotificationsService } from "../../services/notifications.service.js";
import type { MarkNotificationReadCommand } from "./markNotificationRead.command.js";

export class MarkNotificationReadHandler extends CommandHandler<MarkNotificationReadCommand, void> {
  public readonly commandType = "notifications.markNotificationRead" as const;

  public constructor(private readonly notificationsService: NotificationsService) {
    super();
  }

  public async execute(command: MarkNotificationReadCommand): Promise<void> {
    const { notifications, clock } = this.notificationsService.dependencies;
    const marked = await notifications.markOwnNotificationRead(command.principal.userId, command.notificationId, clock.now());
    if (!marked) throw notFound("Notification");
  }
}
