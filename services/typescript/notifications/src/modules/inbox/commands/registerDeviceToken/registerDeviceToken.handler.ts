import type { DeviceTokenRepository } from "../../../../interfaces/repositories.interface.js";
import type { RegisterDeviceTokenCommand } from "./registerDeviceToken.command.js";

export class RegisterDeviceTokenHandler {
  public constructor(private readonly deviceTokens: DeviceTokenRepository) {}

  public async execute(command: RegisterDeviceTokenCommand): Promise<void> {
    await this.deviceTokens.register(command.userId, command.token, command.platform, command.provider ?? "expo");
  }
}
