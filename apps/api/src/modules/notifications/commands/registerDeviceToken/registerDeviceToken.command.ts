import { Command } from "@zudojs/cqrs";

import type { DevicePlatform } from "../../models/notifications.model.js";
import type { Principal } from "../../../../interfaces/principal.interface.js";

export class RegisterDeviceTokenCommand extends Command<"notifications.registerDeviceToken"> {
  public constructor(
    public readonly principal: Principal,
    public readonly token: string,
    public readonly platform: DevicePlatform,
  ) {
    super("notifications.registerDeviceToken");
  }
}
