import { notFoundError } from "../../../../errors/notifications.error.js";
import type { NotificationRepository } from "../../../../interfaces/repositories.interface.js";
import type { MarkNotificationReadCommand } from "./markNotificationRead.command.js";

export class MarkNotificationReadHandler {
  public constructor(private readonly notifications: NotificationRepository, private readonly now: () => Date = () => new Date()) {}

  public async execute(command: MarkNotificationReadCommand): Promise<void> {
    if (!(await this.notifications.markRead(command.userId, command.notificationId, this.now()))) throw notFoundError("Notification not found.");
  }
}
