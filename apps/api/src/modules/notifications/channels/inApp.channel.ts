import type { NotificationRequestedPayload } from "../../../events/notificationRequested.event.js";
import type { Clock } from "../../../interfaces/clock.interface.js";
import type { NotificationRecord } from "../models/notifications.model.js";
import type { NotificationsRepository } from "../repositories/notifications.repository.js";

export class InAppChannel {
  public constructor(private readonly notifications: NotificationsRepository, private readonly clock: Clock) {}

  public storeInAppNotification(request: NotificationRequestedPayload): Promise<NotificationRecord> {
    return this.notifications.create(
      { userId: request.userId, category: request.category, title: request.title, body: request.body, data: request.data ?? {} },
      this.clock.now(),
    );
  }
}
