import { Command } from "@zudojs/cqrs";

import type { Principal } from "../../../../interfaces/principal.interface.js";

export class MarkNotificationReadCommand extends Command<"notifications.markNotificationRead"> {
  public constructor(
    public readonly principal: Principal,
    public readonly notificationId: string,
  ) {
    super("notifications.markNotificationRead");
  }
}
