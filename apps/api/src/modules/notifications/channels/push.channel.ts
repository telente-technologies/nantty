import type { AppLogger } from "../../../loggers/app.logger.js";
import type { NotificationRecord } from "../models/notifications.model.js";
import type { DeviceTokensRepository } from "../repositories/deviceTokens.repository.js";

export interface PushMessage {
  readonly deviceTokens: readonly string[];
  readonly title: string;
  readonly body: string;
  readonly data: Readonly<Record<string, string>>;
}

export interface PushSender {
  sendPushMessage(message: PushMessage): Promise<void>;
}

export class UnconfiguredPushSender implements PushSender {
  public constructor(private readonly logger: AppLogger) {}

  public async sendPushMessage(message: PushMessage): Promise<void> {
    this.logger.warn("No push provider is configured; the push notification was not sent.", { deviceCount: message.deviceTokens.length });
  }
}

export class PushChannel {
  public constructor(private readonly deviceTokens: DeviceTokensRepository, private readonly pushSender: PushSender) {}

  public async deliverNotificationByPush(notification: NotificationRecord): Promise<void> {
    const tokens = await this.deviceTokens.listTokensForUser(notification.userId);
    if (tokens.length === 0) return;
    await this.pushSender.sendPushMessage({
      deviceTokens: tokens.map((record) => record.token),
      title: notification.title,
      body: notification.body,
      data: { ...notification.data, notificationId: notification.id, category: notification.category },
    });
  }
}
