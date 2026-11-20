import { consentRules, defineEmailTemplate } from "./defineTemplate";

const base = { category: "support", kind: "transactional", audience: "User with a ticket", consent: consentRules.always } as const;

interface TicketProps {
  readonly firstName: string;
  readonly ticketId: string;
  readonly subjectLine: string;
  readonly ticketUrl: string;
}

const sampleTicket: TicketProps = { firstName: "Amaka", ticketId: "SUP-20419", subjectLine: "Refund hasn't arrived for order ZM-48213", ticketUrl: "https://nantty.com/help/tickets/7b9e2f3a-1111-4222-8333-123456789abc" };
const ref = (p: TicketProps) => `TICKET ${p.ticketId}`;

export const supportTicketReceived = defineEmailTemplate<TicketProps & { readonly firstResponseHours: number }>({
  ...base, key: "supportTicketReceived", name: "Support ticket received", trigger: "ticket.created",
  subject: (p) => `[${p.ticketId}] We got your message: ${p.subjectLine}`,
  preheader: (p) => `A person will reply within ${p.firstResponseHours} hours.`,
  reference: ref,
  blocks: (p) => [
    { type: "hero", eyebrow: "Support", title: "We're on it" },
    { type: "paragraph", text: [`Hi ${p.firstName}, thanks for getting in touch about `, { strong: p.subjectLine }, `. A member of our support team will reply within ${p.firstResponseHours} hours.`] },
    { type: "paragraph", text: "Add details or screenshots from the ticket in the app or on the web. Everything stays in the same ticket." },
    { type: "button", label: "View ticket", href: p.ticketUrl },
  ],
  sample: { ...sampleTicket, firstResponseHours: 12 },
});

export const supportAgentReplied = defineEmailTemplate<TicketProps & { readonly agentName: string; readonly message: string; readonly repliedAt: string }>({
  ...base, key: "supportAgentReplied", name: "Support agent replied", trigger: "ticket.replied (staff reply)",
  subject: (p) => `[${p.ticketId}] ${p.agentName} replied`,
  preheader: (p) => p.message.slice(0, 90),
  reference: ref,
  blocks: (p, c) => [
    { type: "hero", eyebrow: "Support reply", title: `${p.agentName} replied to your ticket` },
    { type: "quote", author: `${p.agentName}, Nantty Support`, meta: c.dateTime(p.repliedAt), text: p.message },
    { type: "button", label: "Reply", href: p.ticketUrl },
    { type: "paragraph", muted: true, text: "Replies to this email are not monitored. Reply from the ticket instead." },
  ],
  sample: { ...sampleTicket, agentName: "Deji", repliedAt: "2026-10-03T11:05:00.000Z", message: "Hi Amaka, thanks for waiting. The refund left us on 3 October with reference RF-20261003-8841. Card refunds can take up to 5 business days. If it's not there by Friday, reply here and I'll chase it with the bank." },
});

export const supportTicketResolved = defineEmailTemplate<TicketProps & { readonly resolution: string; readonly reopenDays: number }>({
  ...base, key: "supportTicketResolved", name: "Support ticket resolved", trigger: "ticket.resolved",
  subject: (p) => `[${p.ticketId}] Resolved — how did we do?`,
  preheader: () => "Rate your support in one tap.",
  reference: ref,
  blocks: (p) => [
    { type: "hero", eyebrow: "Resolved", title: "We've closed your ticket", tone: "success" },
    { type: "paragraph", text: p.resolution },
    { type: "rating", question: "How happy are you with the help you got?", options: [
      { label: "1", href: `${p.ticketUrl}/rate?score=1` },
      { label: "2", href: `${p.ticketUrl}/rate?score=2` },
      { label: "3", href: `${p.ticketUrl}/rate?score=3` },
      { label: "4", href: `${p.ticketUrl}/rate?score=4` },
      { label: "5", href: `${p.ticketUrl}/rate?score=5` },
    ] },
    { type: "paragraph", muted: true, text: `Not sorted? Reply on the ticket within ${p.reopenDays} days and it reopens.` },
  ],
  sample: { ...sampleTicket, resolution: "Your refund arrived on 6 October, so we've closed this ticket. Thanks for your patience.", reopenDays: 7 },
});

export interface SupportInboxTicketAlertProps {
  readonly ticketId: string;
  readonly reference: string;
  readonly subjectLine: string;
  readonly category: string;
  readonly priority: string;
  readonly channel: string;
  readonly firstResponseHours: number;
  readonly ticketUrl: string;
}

export const supportInboxTicketAlert = defineEmailTemplate<SupportInboxTicketAlertProps>({
  ...base,
  key: "supportInboxTicketAlert",
  name: "Support inbox ticket alert",
  trigger: "ticket.created (staff inbox alert)",
  audience: "Nantty support inbox",
  subject: (p) => `[Nantty Support] ${p.reference} ${p.subjectLine}`.slice(0, 200),
  preheader: (p) => `${p.priority} priority ${p.category} ticket — reply within ${p.firstResponseHours} hours.`,
  reference: (p) => `TICKET ${p.reference}`,
  blocks: (p) => [
    { type: "hero", eyebrow: "Support inbox", title: "New support ticket opened" },
    { type: "paragraph", text: ["A new support ticket was opened: ", { strong: p.subjectLine }] },
    {
      type: "details",
      rows: [
        { label: "Reference", value: p.reference, strong: true },
        { label: "Category", value: p.category },
        { label: "Priority", value: p.priority },
        { label: "Channel", value: p.channel },
        { label: "First reply due within", value: `${p.firstResponseHours} hours` },
      ],
    },
    { type: "button", label: "Open it in the admin console", href: p.ticketUrl },
  ],
  sample: {
    ticketId: "7b9e2f3a-1111-4222-8333-123456789abc",
    reference: "SUP-20419",
    subjectLine: "Refund hasn't arrived for order ZM-48213",
    category: "payment",
    priority: "high",
    channel: "web",
    firstResponseHours: 4,
    ticketUrl: "https://admin.nantty.com/support/7b9e2f3a-1111-4222-8333-123456789abc",
  },
});

export interface SupportEmailDeliveryAlertProps {
  readonly eventId: string;
  readonly templateKey: string;
  readonly reason: string;
  readonly deliveryUrl: string;
}

export const supportEmailDeliveryAlert = defineEmailTemplate<SupportEmailDeliveryAlertProps>({
  ...base,
  key: "supportEmailDeliveryAlert",
  name: "Transactional email delivery failure alert",
  trigger: "email.alertDeliveryFailure",
  audience: "Nantty operations inbox",
  subject: (p) => `[Nantty Operations] Transactional email failed: ${p.templateKey}`.slice(0, 200),
  preheader: (p) => `Delivery stopped after 4 attempts (${p.reason}).`,
  blocks: (p) => [
    { type: "hero", eyebrow: "Operations alert", title: `Transactional email failed: ${p.templateKey}`, tone: "danger" },
    { type: "paragraph", text: "Delivery stopped after four total attempts and requires investigation." },
    {
      type: "details",
      rows: [
        { label: "Event", value: p.eventId, strong: true },
        { label: "Template", value: p.templateKey },
        { label: "Reason", value: p.reason },
      ],
    },
    { type: "button", label: "Review notification operations", href: p.deliveryUrl },
  ],
  sample: {
    eventId: "evt-mail-1",
    templateKey: "orderShipped",
    reason: "email_provider_send_failed",
    deliveryUrl: "https://admin.nantty.com/operations/notifications",
  },
});
