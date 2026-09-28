import { Command } from "@zudojs/cqrs";

import type { NotificationRequestedPayload } from "../../../../events/notificationRequested.event.js";

export class SendNotificationCommand extends Command<"notifications.sendNotification"> {
  public constructor(
    public readonly request: NotificationRequestedPayload,
  ) {
    super("notifications.sendNotification");
  }
}
