import { BaseModule, type ModuleContext } from "@zudojs/core";
import type { CommandBus, QueryBus } from "@zudojs/cqrs";

import { registerCommandHandlers, registerQueryHandlers } from "../../utils/cqrs.util.js";
import { MarkAllNotificationsReadHandler } from "./commands/markAllNotificationsRead/markAllNotificationsRead.handler.js";
import { MarkNotificationReadHandler } from "./commands/markNotificationRead/markNotificationRead.handler.js";
import { RegisterDeviceTokenHandler } from "./commands/registerDeviceToken/registerDeviceToken.handler.js";
import { RemoveDeviceTokenHandler } from "./commands/removeDeviceToken/removeDeviceToken.handler.js";
import { SendNotificationHandler } from "./commands/sendNotification/sendNotification.handler.js";
import { GetUnreadCountHandler } from "./queries/getUnreadCount/getUnreadCount.handler.js";
import { ListNotificationsHandler } from "./queries/listNotifications/listNotifications.handler.js";
import type { NotificationsService } from "./services/notifications.service.js";

export class NotificationsModule extends BaseModule {
  public readonly id = "notifications";
  public readonly name = "notifications";

  public constructor() {
    super({ version: "0.1.0" });
  }

  public override async onInitialize(context: ModuleContext): Promise<void> {
    context.logger.info("notifications module initialized");
  }

  public override async onShutdown(context: ModuleContext): Promise<void> {
    context.logger.info("notifications module stopped");
  }
}

export function registerNotificationsCommandAndQueryHandlers(commands: CommandBus, queries: QueryBus, notificationsService: NotificationsService): void {
  registerCommandHandlers(commands, [
    new SendNotificationHandler(notificationsService),
    new MarkNotificationReadHandler(notificationsService),
    new MarkAllNotificationsReadHandler(notificationsService),
    new RegisterDeviceTokenHandler(notificationsService),
    new RemoveDeviceTokenHandler(notificationsService),
  ]);
  registerQueryHandlers(queries, [new ListNotificationsHandler(notificationsService), new GetUnreadCountHandler(notificationsService)]);
}
