import type { NotificationRepository } from "../../../../interfaces/repositories.interface.js";
import type { MarkAllNotificationsReadCommand } from "./markAllNotificationsRead.command.js";

export class MarkAllNotificationsReadHandler {
  public constructor(private readonly notifications: NotificationRepository, private readonly now: () => Date = () => new Date()) {}

  public async execute(command: MarkAllNotificationsReadCommand): Promise<void> {
    await this.notifications.markAllRead(command.userId, this.now());
  }
}
