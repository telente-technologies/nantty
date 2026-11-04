import type { IdentityDirectory } from "../../../../interfaces/identityDirectory.interface.js";
import type { JobQueue } from "../../../../interfaces/jobQueue.interface.js";
import type { Logger } from "@nantty/fastify-platform";
import { EmailDeliveryFailure, type EmailDeliveryService } from "../../services/emailDelivery.service.js";
import type { SupportInboxAlertService } from "../../services/supportInboxAlert.service.js";
import type { DeliverTemplateEmailCommand } from "./deliverTemplateEmail.command.js";

export class DeliverTemplateEmailHandler {
  public constructor(private readonly deps: { readonly identity: IdentityDirectory; readonly emailDelivery: EmailDeliveryService; readonly jobQueue: JobQueue; readonly jobsQueueUrl: string; readonly supportInbox?: SupportInboxAlertService; readonly logger: Logger }) {}

  public async execute(command: DeliverTemplateEmailCommand): Promise<"delivered" | "recipient_not_found" | "retry_scheduled" | "failed_terminal"> {
    const recipient = await this.deps.identity.getRecipient(command.userId);
    if (recipient === null) return "recipient_not_found";
    let outcome: Awaited<ReturnType<EmailDeliveryService["deliver"]>>;
    try {
      outcome = await this.deps.emailDelivery.deliver({
        dedupeKey: command.dedupeKey,
        eventId: command.eventId,
        recipient,
        preferenceCategory: command.preferenceCategory,
        templateKey: command.templateKey,
        props: command.props,
      });
    } catch (error) {
      const reason = error instanceof Error ? error.message.slice(0, 200) : "email_delivery_failed";
      const attempt = error instanceof EmailDeliveryFailure ? error.attemptCount : command.attempt ?? 1;
      if (attempt < 4) {
        const delays = [30, 120, 600];
        await this.deps.jobQueue.send(this.deps.jobsQueueUrl, { ...command, attempt: attempt + 1 }, delays[attempt - 1]);
        this.deps.logger.warn("transactional email delivery retry scheduled", { eventId: command.eventId, templateKey: command.templateKey, attempt, nextAttempt: attempt + 1, delaySeconds: delays[attempt - 1] });
        return "retry_scheduled";
      }
      this.deps.logger.error("transactional email delivery exhausted retries", { eventId: command.eventId, templateKey: command.templateKey, attempt, reason });
      await this.enqueueFailureAlert(command, reason);
      return "failed_terminal";
    }
    if (outcome.status === "duplicate" && outcome.previous === "failed") {
      await this.enqueueFailureAlert(command, "email_provider_send_failed");
      return "failed_terminal";
    }
    return "delivered";
  }

  private async enqueueFailureAlert(command: DeliverTemplateEmailCommand, reason: string): Promise<void> {
    if (this.deps.supportInbox === undefined) throw new Error("email delivery failure alerts are not configured");
    await this.deps.supportInbox.notifyEmailDeliveryFailed({ eventId: command.eventId, templateKey: command.templateKey, reason });
  }
}
