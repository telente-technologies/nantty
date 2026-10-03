import { maximumSqsDelaySeconds, unreadEmailJobType } from "../../../../constants/delivery.constant.js";
import type { IdentityDirectory } from "../../../../interfaces/identityDirectory.interface.js";
import type { JobQueue } from "../../../../interfaces/jobQueue.interface.js";
import type { DeliveryRepository, NotificationRepository } from "../../../../interfaces/repositories.interface.js";
import type { EmailDeliveryService } from "../../services/emailDelivery.service.js";
import type { DeliverEmailIfStillUnreadCommand } from "./deliverEmailIfStillUnread.command.js";

export class DeliverEmailIfStillUnreadHandler {
  public constructor(
    private readonly deps: {
      readonly notifications: NotificationRepository;
      readonly deliveries: DeliveryRepository;
      readonly identity: IdentityDirectory;
      readonly emailDelivery: EmailDeliveryService;
      readonly jobQueue: JobQueue;
      readonly jobsQueueUrl: string;
      readonly now?: () => Date;
    },
  ) {}

  public async execute(command: DeliverEmailIfStillUnreadCommand): Promise<"waiting" | "read_in_app" | "delivered" | "recipient_not_found"> {
    const now = (this.deps.now ?? (() => new Date()))();
    const remainingSeconds = (Date.parse(command.notBefore) - now.getTime()) / 1000;
    if (remainingSeconds > 0) {
      await this.deps.jobQueue.send(this.deps.jobsQueueUrl, { ...command, type: unreadEmailJobType }, Math.min(maximumSqsDelaySeconds, remainingSeconds));
      return "waiting";
    }
    const notification = await this.deps.notifications.findByDedupeKey(command.notificationKey);
    if (notification !== null && notification.readAt !== null) {
      const claim = await this.deps.deliveries.claim({ dedupeKey: command.emailDedupeKey, eventId: command.eventId, userId: command.userId, channel: "email", templateKey: command.templateKey, mailKind: null });
      if (!claim.alreadyProcessed) await this.deps.deliveries.finish(claim.id, "skipped", { skipReason: "read_in_app" });
      return "read_in_app";
    }
    const recipient = await this.deps.identity.getRecipient(command.userId);
    if (recipient === null) return "recipient_not_found";
    await this.deps.emailDelivery.deliver({ dedupeKey: command.emailDedupeKey, eventId: command.eventId, recipient, preferenceCategory: command.preferenceCategory, templateKey: command.templateKey, props: command.props });
    return "delivered";
  }
}
