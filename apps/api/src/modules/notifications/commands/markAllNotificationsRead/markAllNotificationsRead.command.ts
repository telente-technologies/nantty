import { Command } from "@zudojs/cqrs";

import type { Principal } from "../../../../interfaces/principal.interface.js";

export class MarkAllNotificationsReadCommand extends Command<"notifications.markAllNotificationsRead"> {
  public constructor(
    public readonly principal: Principal,
  ) {
    super("notifications.markAllNotificationsRead");
  }
}
