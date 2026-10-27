import type { DomainEventEnvelope } from "../../../types/domainEvent.type.js";
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
  public constructor(private readonly deps: { readonly emailDelivery: EmailDeliveryService; readonly recipients: readonly string[]; readonly adminBaseUrl: string }) {}

  public async notifyTicketCreated(event: DomainEventEnvelope): Promise<readonly string[]> {
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
