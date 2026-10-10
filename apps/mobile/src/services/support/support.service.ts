import type { ContentReport, NewSupportTicketInput, SupportTicketDetail, SupportTicketMessage, SupportTicketSummary } from "@/types/support.type";

import { api } from "../core/apiClient.service";

export const supportService = {
  listMySupportTickets: () => api.getList<SupportTicketSummary>("/api/v1/support/tickets"),
  fetchUnreadSupportReplies: () => api.get<{ count: number }>("/api/v1/support/tickets/unread-count"),
  createSupportTicket: (input: NewSupportTicketInput, idempotencyKey: string) =>
    api.post<SupportTicketDetail>("/api/v1/support/tickets", input, { idempotencyKey }),
  fetchSupportTicket: (ticketId: string) => api.get<SupportTicketDetail>(`/api/v1/support/tickets/${encodeURIComponent(ticketId)}`),
  markSupportTicketRead: (ticketId: string) => api.post<void>(`/api/v1/support/tickets/${encodeURIComponent(ticketId)}/read`, {}),
  rateSupportTicket: (ticketId: string, score: number, comment: string | null) =>
    api.post<SupportTicketSummary>(`/api/v1/support/tickets/${encodeURIComponent(ticketId)}/rating`, { score, comment }),
  replyToSupportTicket: (ticketId: string, text: string, idempotencyKey: string) =>
    api.post<SupportTicketMessage>(`/api/v1/support/tickets/${encodeURIComponent(ticketId)}/messages`, { text, attachmentUrls: [] }, { idempotencyKey }),
  listMyContentReports: () => api.getList<ContentReport>("/api/v1/reports/me"),
};
