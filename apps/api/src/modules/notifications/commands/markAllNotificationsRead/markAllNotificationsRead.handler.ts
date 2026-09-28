import { CommandHandler } from "@zudojs/cqrs";

import type { NotificationsService } from "../../services/notifications.service.js";
import type { MarkAllNotificationsReadCommand } from "./markAllNotificationsRead.command.js";

export class MarkAllNotificationsReadHandler extends CommandHandler<MarkAllNotificationsReadCommand, number> {
  public readonly commandType = "notifications.markAllNotificationsRead" as const;

  public constructor(private readonly notificationsService: NotificationsService) {
    super();
  }

  public execute(command: MarkAllNotificationsReadCommand): Promise<number> {
    const { notifications, clock } = this.notificationsService.dependencies;
    return notifications.markAllOwnNotificationsRead(command.principal.userId, clock.now());
  }
}
