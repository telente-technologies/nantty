import { email } from "../../../integrations/email.integration.js";
import type { UserContact } from "../../../interfaces/userDirectory.interface.js";
import type { NotificationRecord } from "../models/notifications.model.js";

export interface NotificationEmailSender {
  sendNotificationEmail(to: string, subject: string, text: string): Promise<void>;
}

export class IntegrationNotificationEmailSender implements NotificationEmailSender {
  public async sendNotificationEmail(to: string, subject: string, text: string): Promise<void> {
    await email().send({ to, subject, text });
  }
}

const EMAIL_CATEGORIES: ReadonlySet<string> = new Set(["orders", "payments"]);

export class EmailChannel {
  public constructor(private readonly sender: NotificationEmailSender) {}

  public async deliverNotificationByEmail(notification: NotificationRecord, contact: UserContact): Promise<void> {
    if (!EMAIL_CATEGORIES.has(notification.category) || contact.email === null) return;
    await this.sender.sendNotificationEmail(contact.email, notification.title, notification.body);
  }
}
