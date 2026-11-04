import type { DomainEventEnvelope } from "../../../types/domainEvent.type.js";
import type { JobQueue } from "../../../interfaces/jobQueue.interface.js";
import { failedEmailAlertJobType, supportTicketAlertJobType } from "../../../constants/delivery.constant.js";
import type { Recipient } from "../../../types/notification.type.js";
import { EventDataReader } from "../../../utils/eventDataReader.util.js";
import type { EmailDeliveryService } from "./emailDelivery.service.js";

const escapeHtml = (value: string) => value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

export interface SupportInboxAlert {
  readonly subject: string;
  readonly text: string;
  readonly html: string;
}

export function composeSupportInboxAlert(data: EventDataReader, adminBaseUrl: string): SupportInboxAlert {
  const ticketId = data.text("ticketId");
  const reference = data.text("reference", ticketId);
  const subjectLine = data.text("subject", "(no subject)").replace(/[\r\n]+/g, " ");
  const ticketUrl = `${adminBaseUrl.replace(/\/+$/, "")}/support/${encodeURIComponent(ticketId)}`;
  const rows: [string, string][] = [
    ["Reference", reference],
    ["Category", data.text("category", "other")],
    ["Priority", data.text("priority", "normal")],
    ["Channel", data.text("channel", "web")],
    ["First reply due within", `${data.integer("firstResponseHours", 8)} hours`],
  ];
  const text = [`A new support ticket was opened: ${subjectLine}`, "", ...rows.map(([label, value]) => `${label}: ${value}`), "", `Open it in the admin console: ${ticketUrl}`].join("\n");
  const table = rows.map(([label, value]) => `<tr><td style="padding:4px 12px 4px 0;color:#666">${escapeHtml(label)}</td><td style="padding:4px 0">${escapeHtml(value)}</td></tr>`).join("");
  const html = `<!doctype html><html><body style="margin:0;padding:24px;font-family:Arial,Helvetica,sans-serif;color:#111;background:#fff"><div style="max-width:560px;margin:0 auto"><p style="margin:0 0 16px;line-height:1.5">A new support ticket was opened: <strong>${escapeHtml(subjectLine)}</strong></p><table style="border-collapse:collapse;font-size:14px">${table}</table><p style="margin:24px 0 0"><a href="${escapeHtml(ticketUrl)}">Open it in the admin console</a></p></div></body></html>`;
  return { subject: `[Nantty Support] ${reference} ${subjectLine}`.slice(0, 200), text, html };
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
    const subject = `Transactional email failed: ${input.templateKey}`;
    const deliveryUrl = `${this.deps.adminBaseUrl.replace(/\/+$/, "")}/operations/notifications`;
    const text = [`${subject} after four total attempts.`, `Event: ${input.eventId}`, `Reason: ${input.reason}`, `Review delivery records: ${deliveryUrl}`].join("\n");
    const html = `<!doctype html><html><body style="font-family:Arial,Helvetica,sans-serif;color:#111"><h2>${escapeHtml(subject)}</h2><p>Delivery stopped after four total attempts.</p><dl><dt>Event</dt><dd>${escapeHtml(input.eventId)}</dd><dt>Reason</dt><dd>${escapeHtml(input.reason)}</dd></dl><p><a href="${escapeHtml(deliveryUrl)}">Review notification operations</a></p></body></html>`;
    if (!this.deps.recipients.includes(input.address)) throw new Error("support alert recipient is not configured");
    await this.deps.emailDelivery.deliverCustom({
      dedupeKey: `email-delivery-failed:${input.eventId}:${input.templateKey}:${input.address}`,
      eventId: input.eventId,
      recipient: inboxRecipient(input.address),
      preferenceCategory: "support",
      mailKind: "transactional",
      render: () => ({ subject: `[Nantty Operations] ${subject}`.slice(0, 200), text, html }),
    });
  }

  public async notifyTicketCreated(event: DomainEventEnvelope): Promise<readonly string[]> {
    if (this.deps.recipients.length === 0) return [];
    await this.deps.jobQueue.send(this.deps.jobsQueueUrl, { type: supportTicketAlertJobType, event });
    return ["queued"];
  }

  public async deliverTicketCreated(event: DomainEventEnvelope): Promise<readonly string[]> {
    if (this.deps.recipients.length === 0) return [];
    const alert = composeSupportInboxAlert(new EventDataReader(event.data), this.deps.adminBaseUrl);
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
