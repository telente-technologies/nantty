import type { NewSupportTicketInput, SupportTicketDetail, SupportTicketMessage, SupportTicketSummary } from "@/types/support.type";
import type { HelpVoteResult } from "@/types/helpCentre.type";

import { createIdempotencyKey, sendRequestToWebappServer } from "./clientApi.service";

const ticketPath = (ticketId: string) => `/api/v1/support/tickets/${encodeURIComponent(ticketId)}`;

export const supportService = {
  listMyTickets: () => sendRequestToWebappServer<SupportTicketSummary[]>("/api/v1/support/tickets"),
  fetchUnreadCount: () => sendRequestToWebappServer<{ count: number }>("/api/v1/support/tickets/unread-count"),
  createTicket: (input: NewSupportTicketInput, idempotencyKey: string = createIdempotencyKey("ticket")) =>
    sendRequestToWebappServer<SupportTicketDetail>("/api/v1/support/tickets", { method: "POST", body: input, idempotencyKey }),
  fetchTicket: (ticketId: string) => sendRequestToWebappServer<SupportTicketDetail>(ticketPath(ticketId)),
  replyToTicket: (ticketId: string, text: string) =>
    sendRequestToWebappServer<SupportTicketMessage>(`${ticketPath(ticketId)}/messages`, { method: "POST", body: { text, attachmentUrls: [] }, idempotencyKey: createIdempotencyKey("ticketreply") }),
  markTicketRead: (ticketId: string) => sendRequestToWebappServer<void>(`${ticketPath(ticketId)}/read`, { method: "POST", body: {} }),
  rateTicket: (ticketId: string, score: number, comment: string | null) =>
    sendRequestToWebappServer<SupportTicketSummary>(`${ticketPath(ticketId)}/rating`, { method: "POST", body: { score, comment } }),
  voteOnHelpTopic: (topicId: string, helpful: boolean) =>
    sendRequestToWebappServer<HelpVoteResult>(`/api/v1/help/topics/${encodeURIComponent(topicId)}/votes`, { method: "POST", body: { helpful } }),
};
