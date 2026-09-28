import type { NotificationRequestedPayload } from "../../../events/notificationRequested.event.js";
import type { Clock } from "../../../interfaces/clock.interface.js";
import type { UserDirectory } from "../../../interfaces/userDirectory.interface.js";
import type { AppLogger } from "../../../loggers/app.logger.js";
import type { EmailChannel } from "../channels/email.channel.js";
import type { InAppChannel } from "../channels/inApp.channel.js";
import type { PushChannel } from "../channels/push.channel.js";
import type { NotificationRecord } from "../models/notifications.model.js";
import type { DeviceTokensRepository } from "../repositories/deviceTokens.repository.js";
import type { NotificationsRepository } from "../repositories/notifications.repository.js";

export interface NotificationsDependencies {
  readonly notifications: NotificationsRepository;
  readonly deviceTokens: DeviceTokensRepository;
  readonly userDirectory: UserDirectory;
  readonly inAppChannel: InAppChannel;
  readonly pushChannel: PushChannel;
  readonly emailChannel: EmailChannel;
  readonly clock: Clock;
  readonly logger: AppLogger;
}

export class NotificationsService {
  public constructor(public readonly dependencies: NotificationsDependencies) {}

  public async deliverRequestedNotification(request: NotificationRequestedPayload): Promise<NotificationRecord | undefined> {
    const { userDirectory, inAppChannel, pushChannel, emailChannel, logger } = this.dependencies;
    const contact = await userDirectory.findUserContact(request.userId);
    if (contact === undefined || contact.notificationPreferences[request.category] === false) return undefined;
    const notification = await inAppChannel.storeInAppNotification(request);
    await this.runChannelWithoutFailingDelivery("push", () => pushChannel.deliverNotificationByPush(notification), logger);
    await this.runChannelWithoutFailingDelivery("email", () => emailChannel.deliverNotificationByEmail(notification, contact), logger);
    return notification;
  }

  private async runChannelWithoutFailingDelivery(channel: string, deliver: () => Promise<void>, logger: AppLogger): Promise<void> {
    try {
      await deliver();
    } catch (error) {
      logger.warn("A notification channel failed", { channel, error: error instanceof Error ? error.message : String(error) });
    }
  }
}
