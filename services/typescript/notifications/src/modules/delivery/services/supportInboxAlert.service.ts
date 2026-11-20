import { renderEmail, type EmailBrandConfig } from "@nantty/email-templates";

import type { DomainEventEnvelope } from "../../../types/domainEvent.type.js";
import type { JobQueue } from "../../../interfaces/jobQueue.interface.js";
import { failedEmailAlertJobType, supportTicketAlertJobType } from "../../../constants/delivery.constant.js";
import type { Recipient } from "../../../types/notification.type.js";
import { EventDataReader } from "../../../utils/eventDataReader.util.js";
import type { EmailDeliveryService } from "./emailDelivery.service.js";

export interface SupportInboxAlert {
  readonly subject: string;
  readonly text: string;
  readonly html: string;
}

export async function composeSupportInboxAlert(data: EventDataReader, adminBaseUrl: string, brand?: EmailBrandConfig): Promise<SupportInboxAlert> {
  const ticketId = data.text("ticketId");
  const reference = data.text("reference", ticketId);
  const subjectLine = data.text("subject", "(no subject)").replace(/[\r\n]+/g, " ");
  const ticketUrl = `${adminBaseUrl.replace(/\/+$/, "")}/support/${encodeURIComponent(ticketId)}`;
  const rendered = await renderEmail(
    "supportInboxTicketAlert",
    {
      ticketId,
      reference,
      subjectLine,
      category: data.text("category", "other"),
      priority: data.text("priority", "normal"),
      channel: data.text("channel", "web"),
      firstResponseHours: data.integer("firstResponseHours", 8),
      ticketUrl,
    },
    brand === undefined ? undefined : { brand },
  );
  return { subject: rendered.subject, text: rendered.text, html: rendered.html };
}

function inboxRecipient(address: string): Recipient {
  return { accountId: "support-inbox", email: address, emailVerified: true, firstName: "Support", username: "", marketingConsent: false, status: "active" };
}

export class SupportInboxAlertService {
  public constructor(private readonly deps: { readonly emailDelivery: EmailDeliveryService; readonly recipients: readonly string[]; readonly adminBaseUrl: string; readonly jobQueue: JobQueue; readonly jobsQueueUrl: string }) {}

  public async notifyEmailDeliveryFailed(input: { readonly eventId: string; readonly templateKey: string; readonly reason: string }): Promise<void> {
    if (this.deps.recipients.length === 0) return;
    for (const address of this.deps.recipients) {
      await this.deps.jobQueue.send(this.deps.jobsQueueUrl, { type: failedEmailAlertJobType, ...input, address });
    }
  }

  public async deliverEmailDeliveryFailed(input: { readonly eventId: string; readonly templateKey: string; readonly reason: string; readonly address: string }): Promise<void> {
    const deliveryUrl = `${this.deps.adminBaseUrl.replace(/\/+$/, "")}/operations/notifications`;
    if (!this.deps.recipients.includes(input.address)) throw new Error("support alert recipient is not configured");
    const brand = this.deps.emailDelivery.brand;
    await this.deps.emailDelivery.deliverCustom({
      dedupeKey: `email-delivery-failed:${input.eventId}:${input.templateKey}:${input.address}`,
      eventId: input.eventId,
      recipient: inboxRecipient(input.address),
      preferenceCategory: "support",
      mailKind: "transactional",
      render: async () => {
        const rendered = await renderEmail(
          "supportEmailDeliveryAlert",
          {
            eventId: input.eventId,
            templateKey: input.templateKey,
            reason: input.reason,
            deliveryUrl,
          },
          brand === undefined ? undefined : { brand },
        );
        return { subject: rendered.subject, text: rendered.text, html: rendered.html };
      },
    });
  }

  public async notifyTicketCreated(event: DomainEventEnvelope): Promise<readonly string[]> {
    if (this.deps.recipients.length === 0) return [];
    await this.deps.jobQueue.send(this.deps.jobsQueueUrl, { type: supportTicketAlertJobType, event });
    return ["queued"];
  }

  public async deliverTicketCreated(event: DomainEventEnvelope): Promise<readonly string[]> {
    if (this.deps.recipients.length === 0) return [];
    const alert = await composeSupportInboxAlert(new EventDataReader(event.data), this.deps.adminBaseUrl, this.deps.emailDelivery.brand);
    const outcomes: string[] = [];
    for (const address of this.deps.recipients) {
      const outcome = await this.deps.emailDelivery.deliverCustom({
        dedupeKey: `${event.id}:support-inbox:${address}`, eventId: event.id, recipient: inboxRecipient(address), preferenceCategory: "support", mailKind: "transactional", render: () => alert,
      });
      outcomes.push(outcome.status);
    }
    return outcomes;
  }
}
