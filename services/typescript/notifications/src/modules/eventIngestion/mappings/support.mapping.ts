import type { EventDataReader } from "../../../utils/eventDataReader.util.js";
import { intentFor, plan, type EventMapping, type MappingContext } from "./mappingHelpers.js";

const ticketUrl = (context: MappingContext, data: EventDataReader) => `${context.webBaseUrl}/help/tickets/${encodeURIComponent(data.text("ticketId"))}`;
const linkData = (context: MappingContext, data: EventDataReader) => ({ url: ticketUrl(context, data), ticketId: data.text("ticketId"), screen: "SupportTicketDetail" });

export const ticketCreated: EventMapping = (event, data, context) => [
  intentFor(event, data.text("accountId"), {
    category: "support",
    inApp: { category: "system", title: `We got your request ${data.text("reference")}`, body: "A member of our support team will reply soon.", data: linkData(context, data) },
    email: (recipient) => plan("supportTicketReceived", { firstName: recipient.firstName, ticketId: data.text("reference"), subjectLine: data.text("subject"), ticketUrl: ticketUrl(context, data), firstResponseHours: data.integer("firstResponseHours", 8) }),
  }),
];

export const ticketReplied: EventMapping = (event, data, context) => {
  if (data.text("authorKind", "customer") !== "agent") return [];
  const agentName = data.text("agentName", "Zudomart Support");
  return [
    intentFor(event, data.text("accountId"), {
      category: "support",
      inApp: { category: "system", title: "Support replied to your request", body: `${agentName}: ${data.text("message").slice(0, 120)}`, data: linkData(context, data) },
      push: { title: "Zudomart Support replied", body: data.text("message").slice(0, 120), data: linkData(context, data) },
      email: (recipient) => plan("supportAgentReplied", { firstName: recipient.firstName, ticketId: data.text("reference"), subjectLine: data.text("subject"), ticketUrl: ticketUrl(context, data), agentName, message: data.text("message"), repliedAt: data.text("repliedAt") }),
    }),
  ];
};

export const ticketResolved: EventMapping = (event, data, context) => [
  intentFor(event, data.text("accountId"), {
    category: "support",
    inApp: { category: "system", title: `Request ${data.text("reference")} resolved`, body: "Not sorted? Reply within 7 days to reopen it.", data: linkData(context, data) },
    push: { title: "Your support request is resolved", body: "Tap to rate the help you got.", data: linkData(context, data) },
    email: (recipient) => plan("supportTicketResolved", { firstName: recipient.firstName, ticketId: data.text("reference"), subjectLine: data.text("subject"), ticketUrl: ticketUrl(context, data), resolution: data.text("resolution"), reopenDays: data.integer("reopenDays", 7) }),
  }),
];
