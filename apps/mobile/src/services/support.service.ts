import type { ContentReport, NewSupportTicketInput, SupportTicketDetail, SupportTicketMessage, SupportTicketSummary } from "@/types/support.type";

import { api } from "./apiClient.service";

export const supportService = {
  listMySupportTickets: () => api.get<SupportTicketSummary[]>("/api/v1/support/tickets"),
  createSupportTicket: (input: NewSupportTicketInput, idempotencyKey: string) =>
    api.post<SupportTicketDetail>("/api/v1/support/tickets", input, { idempotencyKey }),
  fetchSupportTicket: (ticketId: string) => api.get<SupportTicketDetail>(`/api/v1/support/tickets/${encodeURIComponent(ticketId)}`),
  replyToSupportTicket: (ticketId: string, text: string, idempotencyKey: string) =>
    api.post<SupportTicketMessage>(`/api/v1/support/tickets/${encodeURIComponent(ticketId)}/messages`, { text, attachmentUrls: [] }, { idempotencyKey }),
  listMyContentReports: () => api.get<ContentReport[]>("/api/v1/reports/me"),
};
