import { CommandHandler } from "@zudojs/cqrs";

import type { NotificationsService } from "../../services/notifications.service.js";
import type { RegisterDeviceTokenCommand } from "./registerDeviceToken.command.js";

export class RegisterDeviceTokenHandler extends CommandHandler<RegisterDeviceTokenCommand, void> {
  public readonly commandType = "notifications.registerDeviceToken" as const;

  public constructor(private readonly notificationsService: NotificationsService) {
    super();
  }

  public async execute(command: RegisterDeviceTokenCommand): Promise<void> {
    const { deviceTokens, clock } = this.notificationsService.dependencies;
    await deviceTokens.registerTokenForUser(command.principal.userId, command.token, command.platform, clock.now());
  }
}
