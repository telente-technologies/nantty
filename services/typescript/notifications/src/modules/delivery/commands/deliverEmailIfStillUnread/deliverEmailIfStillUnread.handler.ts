import { maximumJobDelaySeconds, unreadEmailJobType } from "../../../../constants/delivery.constant.js";
import type { Logger } from "@nantty/fastify-platform";
import type { IdentityDirectory } from "../../../../interfaces/identityDirectory.interface.js";
import type { JobQueue } from "../../../../interfaces/jobQueue.interface.js";
import type { DeliveryRepository, NotificationRepository } from "../../../../interfaces/repositories.interface.js";
import { EmailDeliveryFailure, type EmailDeliveryService } from "../../services/emailDelivery.service.js";
import type { SupportInboxAlertService } from "../../services/supportInboxAlert.service.js";
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
      readonly supportInbox?: SupportInboxAlertService;
      readonly logger: Logger;
    },
  ) {}

  public async execute(command: DeliverEmailIfStillUnreadCommand): Promise<"waiting" | "read_in_app" | "delivered" | "recipient_not_found" | "retry_scheduled" | "failed_terminal"> {
    const now = (this.deps.now ?? (() => new Date()))();
    const remainingSeconds = (Date.parse(command.notBefore) - now.getTime()) / 1000;
    if (remainingSeconds > 0) {
      await this.deps.jobQueue.send(this.deps.jobsQueueUrl, { ...command, type: unreadEmailJobType }, Math.min(maximumJobDelaySeconds, remainingSeconds));
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
    try {
      await this.deps.emailDelivery.deliver({ dedupeKey: command.emailDedupeKey, eventId: command.eventId, recipient, preferenceCategory: command.preferenceCategory, templateKey: command.templateKey, props: command.props });
    } catch (error) {
      const attempt = error instanceof EmailDeliveryFailure ? error.attemptCount : command.attempt ?? 1;
      if (attempt < 4) {
        const delays = [30, 120, 600];
        await this.deps.jobQueue.send(this.deps.jobsQueueUrl, { ...command, attempt: attempt + 1 }, delays[attempt - 1]);
        this.deps.logger.warn("deferred notification email retry scheduled", { eventId: command.eventId, templateKey: command.templateKey, attempt, nextAttempt: attempt + 1, delaySeconds: delays[attempt - 1] });
        return "retry_scheduled";
      }
      this.deps.logger.error("deferred notification email exhausted retries", { eventId: command.eventId, templateKey: command.templateKey, attempt });
      try {
        await this.deps.supportInbox?.notifyEmailDeliveryFailed({ eventId: command.eventId, templateKey: command.templateKey, reason: "email_provider_send_failed" });
      } catch (alertError) {
        this.deps.logger.error("admin alert for deferred email could not be sent", { eventId: command.eventId, templateKey: command.templateKey, errorType: alertError instanceof Error ? alertError.name : "unknown" });
      }
      return "failed_terminal";
    }
    return "delivered";
  }
}
