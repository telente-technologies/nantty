import { sendAdminApiRequest } from "@/services/adminApiClient.service";
import type { PagedList } from "@/types/api.type";
import type { SupportAgent, SupportAssigneeFilter, SupportMacro, SupportTicketCategory, SupportTicketDetail, SupportTicketStatus, SupportTicketSummary } from "@/types/support.type";

const encode = encodeURIComponent;

export interface SupportTicketFilters {
  readonly status?: string;
  readonly priority?: string;
  readonly category?: string;
  readonly assignee?: SupportAssigneeFilter;
  readonly search?: string;
  readonly page?: number;
}

export function fetchSupportTickets(filters: SupportTicketFilters, signal?: AbortSignal): Promise<PagedList<SupportTicketSummary>> {
  return sendAdminApiRequest("/admin/support/tickets", { query: { ...filters }, signal });
}

export function fetchSupportTicketDetail(ticketId: string, signal?: AbortSignal): Promise<SupportTicketDetail> {
  return sendAdminApiRequest(`/admin/support/tickets/${encode(ticketId)}`, { signal });
}

export function sendSupportTicketReply(ticketId: string, input: { body: string; isInternalNote: boolean; statusAfterReply?: SupportTicketStatus }): Promise<SupportTicketDetail> {
  return sendAdminApiRequest(`/admin/support/tickets/${encode(ticketId)}/replies`, { method: "POST", body: input });
}

export function changeSupportTicketStatus(ticketId: string, status: SupportTicketStatus, reason?: string): Promise<SupportTicketDetail> {
  return sendAdminApiRequest(`/admin/support/tickets/${encode(ticketId)}/status`, { method: "POST", body: { status, reason } });
}

export function assignSupportTicket(ticketId: string, assigneeId: string | null, reason?: string): Promise<SupportTicketDetail> {
  return sendAdminApiRequest(`/admin/support/tickets/${encode(ticketId)}/assign`, { method: "POST", body: { assigneeId, reason } });
}

export function fetchSupportAgents(signal?: AbortSignal): Promise<{ items: SupportAgent[] }> {
  return sendAdminApiRequest("/admin/support/agents", { signal });
}

export function fetchSupportMacros(signal?: AbortSignal): Promise<{ items: SupportMacro[]; variables: string[] }> {
  return sendAdminApiRequest("/admin/support/macros", { signal });
}

export interface SupportMacroInput {
  readonly title: string;
  readonly body: string;
  readonly category: SupportTicketCategory | null;
}

export function createSupportMacro(input: SupportMacroInput): Promise<SupportMacro> {
  return sendAdminApiRequest("/admin/support/macros", { method: "POST", body: input });
}

export function updateSupportMacro(macroId: string, input: SupportMacroInput): Promise<SupportMacro> {
  return sendAdminApiRequest(`/admin/support/macros/${encode(macroId)}`, { method: "PUT", body: input });
}

export function deleteSupportMacro(macroId: string): Promise<void> {
  return sendAdminApiRequest(`/admin/support/macros/${encode(macroId)}`, { method: "DELETE" });
}

export function expandSupportMacroVariables(macroBody: string, values: Record<string, string>): string {
  return macroBody.replace(/\{\{\s*([^}]+?)\s*\}\}/g, (placeholder, variableName: string) => values[variableName] ?? placeholder);
}
