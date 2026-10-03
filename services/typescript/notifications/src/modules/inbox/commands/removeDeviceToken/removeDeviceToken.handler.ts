import type { DeviceTokenRepository } from "../../../../interfaces/repositories.interface.js";
import type { RemoveDeviceTokenCommand } from "./removeDeviceToken.command.js";

export class RemoveDeviceTokenHandler {
  public constructor(private readonly deviceTokens: DeviceTokenRepository) {}

  public async execute(command: RemoveDeviceTokenCommand): Promise<void> {
    await this.deviceTokens.remove(command.userId, command.token);
  }
}
