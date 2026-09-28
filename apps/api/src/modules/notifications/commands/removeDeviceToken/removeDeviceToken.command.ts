import { Command } from "@zudojs/cqrs";

import type { Principal } from "../../../../interfaces/principal.interface.js";

export class RemoveDeviceTokenCommand extends Command<"notifications.removeDeviceToken"> {
  public constructor(
    public readonly principal: Principal,
    public readonly token: string,
  ) {
    super("notifications.removeDeviceToken");
  }
}
