import { ApiError } from "@/errors/api.error";
import type { ContentReport, NewSupportTicketInput, SupportTicketDetail } from "@/types/support.type";

import { getSignedInMockUser, isoDateHoursAgo } from "./fixtures.mock";
import { listMyChatReportsMock } from "./chatReports.mock";
import { createMockRoute, type MockRoute } from "./registry.mock";

const SUPPORT_AGENT_NAME = "Nantty Support";
const AGENT_TYPING_MS = 1500;
const AGENT_REPLY_TEXT = "Thanks for the update. I'm looking into this now and will confirm the next step shortly.";

const tickets: SupportTicketDetail[] = [
  {
    id: "tk_301", reference: "SUP-10301", unreadCount: 1, canRate: false, canReply: true, satisfactionScore: null, subject: "Refund for sneakers order ZM-44104", category: "order", status: "awaiting_you", linkedReference: { kind: "order", id: "ZM-44104", label: "Order ZM-44104" }, agentTyping: false,
    lastMessagePreview: "Would you prefer a replacement pair or a refund?", createdAt: isoDateHoursAgo(110), updatedAt: isoDateHoursAgo(70),
    messages: [
      { id: "tm_1", fromSupport: false, authorName: "You", text: "My sneakers arrived damaged and I've opened a dispute. How long does this take?", attachmentUrls: [], createdAt: isoDateHoursAgo(110) },
      { id: "tm_2", fromSupport: true, authorName: SUPPORT_AGENT_NAME, text: "Hi! Most disputes are settled within 3 working days. Your money stays safely in escrow meanwhile.", attachmentUrls: [], createdAt: isoDateHoursAgo(100) },
      { id: "tm_3", fromSupport: true, authorName: SUPPORT_AGENT_NAME, text: "Would you prefer a replacement pair or a refund?", attachmentUrls: [], createdAt: isoDateHoursAgo(70) },
    ],
  },
  {
    id: "tk_288", reference: "SUP-10288", unreadCount: 0, canRate: true, canReply: true, satisfactionScore: null, subject: "Can't add my OPay account for payouts", category: "payment", status: "resolved", linkedReference: null, agentTyping: false,
    lastMessagePreview: "Glad it works now! Closing this ticket.", createdAt: isoDateHoursAgo(900), updatedAt: isoDateHoursAgo(860),
    messages: [
      { id: "tm_4", fromSupport: false, authorName: "You", text: "It keeps saying account not found.", attachmentUrls: [], createdAt: isoDateHoursAgo(900) },
      { id: "tm_5", fromSupport: true, authorName: SUPPORT_AGENT_NAME, text: "OPay was briefly down on the bank network. Please try again now.", attachmentUrls: [], createdAt: isoDateHoursAgo(880) },
      { id: "tm_6", fromSupport: true, authorName: SUPPORT_AGENT_NAME, text: "Glad it works now! Closing this ticket.", attachmentUrls: [], createdAt: isoDateHoursAgo(860) },
    ],
  },
];

const reports: ContentReport[] = [
  { id: "rp_1", targetType: "user", targetLabel: "@cheap_iphones_lagos", reason: "Scam or fraud", status: "action_taken", outcomeNote: "We removed this account. Thanks for keeping Nantty safe.", createdAt: isoDateHoursAgo(300), updatedAt: isoDateHoursAgo(250) },
  { id: "rp_2", targetType: "post", targetLabel: "Post: \"DM for crypto doubling…\"", reason: "Spam", status: "reviewing", outcomeNote: null, createdAt: isoDateHoursAgo(30), updatedAt: isoDateHoursAgo(20) },
  { id: "rp_3", targetType: "comment", targetLabel: "Comment on Owambe Edit post", reason: "Harassment", status: "no_violation", outcomeNote: "This didn't break our guidelines, but you can block the account.", createdAt: isoDateHoursAgo(500), updatedAt: isoDateHoursAgo(480) },
];

const toSummary = ({ messages: _messages, agentTyping: _agentTyping, ...summary }: SupportTicketDetail) => summary;

const scheduleAgentReply = (ticketId: string) => {
  const update = (change: (ticket: SupportTicketDetail) => SupportTicketDetail) => {
    const index = tickets.findIndex((candidate) => candidate.id === ticketId);
    if (index >= 0) tickets[index] = change(tickets[index]!);
  };
  update((ticket) => ({ ...ticket, agentTyping: true }));
  setTimeout(() => {
    const createdAt = new Date().toISOString();
    update((ticket) => ({
      ...ticket,
      agentTyping: false,
      status: "awaiting_you",
      unreadCount: (ticket.unreadCount ?? 0) + 1,
      lastMessagePreview: AGENT_REPLY_TEXT,
      updatedAt: createdAt,
      messages: [...ticket.messages, { id: `tm_${Date.now()}_agent`, fromSupport: true, authorName: SUPPORT_AGENT_NAME, text: AGENT_REPLY_TEXT, attachmentUrls: [], createdAt }],
    }));
  }, AGENT_TYPING_MS);
};

export const supportMocks: MockRoute[] = [
  createMockRoute("GET", "/api/v1/support/tickets", () => tickets.map(toSummary)),
  createMockRoute("POST", "/api/v1/support/tickets", ({ body }) => {
    const input = body as NewSupportTicketInput;
    if (input.subject.trim().length < 4 || input.message.trim().length < 10) throw new ApiError(422, "Add a subject and describe the problem");
    const now = new Date().toISOString();
    const ticket: SupportTicketDetail = {
      id: `tk_${Date.now()}`, reference: `SUP-${10_400 + tickets.length}`, unreadCount: 0, canRate: false, canReply: true, satisfactionScore: null, subject: input.subject.trim(), category: input.category, status: "open", linkedReference: input.linkedReference, agentTyping: false, lastMessagePreview: input.message.trim(), createdAt: now, updatedAt: now,
      messages: [
        { id: `tm_${Date.now()}`, fromSupport: false, authorName: "You", text: input.message.trim(), attachmentUrls: input.attachmentUrls, createdAt: now },
        { id: `tm_${Date.now()}_auto`, fromSupport: true, authorName: SUPPORT_AGENT_NAME, text: `Thanks ${getSignedInMockUser().name.split(" ")[0]}, we've received your request. A member of our team will reply within 24 hours.`, attachmentUrls: [], createdAt: now },
      ],
    };
    tickets.unshift(ticket);
    return ticket;
  }),
  createMockRoute("GET", "/api/v1/support/tickets/unread-count", () => ({ count: tickets.reduce((sum, ticket) => sum + (ticket.unreadCount ?? 0), 0) })),
  createMockRoute("POST", "/api/v1/support/tickets/:ticketId/read", ({ params }) => {
    const index = tickets.findIndex((candidate) => candidate.id === params.ticketId);
    if (index >= 0) tickets[index] = { ...tickets[index]!, unreadCount: 0 };
    return undefined;
  }),
  createMockRoute("POST", "/api/v1/support/tickets/:ticketId/rating", ({ params, body }) => {
    const index = tickets.findIndex((candidate) => candidate.id === params.ticketId);
    if (index < 0) throw new ApiError(404, "Ticket not found");
    const ticket = tickets[index]!;
    if (ticket.status !== "resolved" && ticket.status !== "closed") throw new ApiError(409, "You can rate support once your ticket is resolved.");
    tickets[index] = { ...ticket, satisfactionScore: (body as { score: number }).score, canRate: false };
    return toSummary(tickets[index]!);
  }),
  createMockRoute("GET", "/api/v1/support/tickets/:ticketId", ({ params }) => {
    const ticket = tickets.find((candidate) => candidate.id === params.ticketId);
    if (!ticket) throw new ApiError(404, "Ticket not found");
    return ticket;
  }),
  createMockRoute("POST", "/api/v1/support/tickets/:ticketId/messages", ({ params, body }) => {
    const index = tickets.findIndex((candidate) => candidate.id === params.ticketId);
    if (index < 0) throw new ApiError(404, "Ticket not found");
    const message = { id: `tm_${Date.now()}`, fromSupport: false, authorName: "You", text: (body as { text: string }).text, attachmentUrls: [], createdAt: new Date().toISOString() };
    const ticket = tickets[index]!;
    tickets[index] = { ...ticket, status: "awaiting_support", canRate: false, lastMessagePreview: message.text, updatedAt: message.createdAt, messages: [...ticket.messages, message] };
    scheduleAgentReply(ticket.id);
    return message;
  }),
  createMockRoute("GET", "/api/v1/reports/me", () => [...listMyChatReportsMock(), ...reports]),
];
