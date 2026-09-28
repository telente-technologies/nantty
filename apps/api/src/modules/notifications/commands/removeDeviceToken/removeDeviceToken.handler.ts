import { CommandHandler } from "@zudojs/cqrs";

import { notFound } from "../../../../errors/domain.error.js";
import type { NotificationsService } from "../../services/notifications.service.js";
import type { RemoveDeviceTokenCommand } from "./removeDeviceToken.command.js";

export class RemoveDeviceTokenHandler extends CommandHandler<RemoveDeviceTokenCommand, void> {
  public readonly commandType = "notifications.removeDeviceToken" as const;

  public constructor(private readonly notificationsService: NotificationsService) {
    super();
  }

  public async execute(command: RemoveDeviceTokenCommand): Promise<void> {
    const removed = await this.notificationsService.dependencies.deviceTokens.deleteOwnToken(command.principal.userId, command.token);
    if (!removed) throw notFound("Device token");
  }
}
