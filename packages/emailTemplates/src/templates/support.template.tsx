import { consentRules, defineEmailTemplate } from "./defineTemplate";

const base = { category: "support", kind: "transactional", audience: "User with a ticket", consent: consentRules.always } as const;

interface TicketProps {
  readonly firstName: string;
  readonly ticketId: string;
  readonly subjectLine: string;
  readonly ticketUrl: string;
}

const sampleTicket: TicketProps = { firstName: "Amaka", ticketId: "SUP-20419", subjectLine: "Refund hasn't arrived for order ZM-48213", ticketUrl: "https://zudomart.com/help/tickets/7b9e2f3a-1111-4222-8333-123456789abc" };
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
    { type: "quote", author: `${p.agentName}, Zudomart Support`, meta: c.dateTime(p.repliedAt), text: p.message },
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
