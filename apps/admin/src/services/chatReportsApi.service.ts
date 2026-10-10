import { sendAdminApiRequest } from "@/services/adminApiClient.service";
import type { PagedList } from "@/types/api.type";
import type { ChatEvidenceRetentionSettings, ChatReportAction, ChatReportDetail, ChatReportSummary } from "@/types/chatReport.type";

export interface ChatReportQueueFilters {
  readonly status?: string;
  readonly targetType?: string;
  readonly reason?: string;
  readonly priority?: string;
  readonly search?: string;
  readonly cursor?: string;
}

export function fetchChatReports(filters: ChatReportQueueFilters, signal?: AbortSignal): Promise<PagedList<ChatReportSummary>> {
  return sendAdminApiRequest("/admin/chat-reports", { query: { ...filters }, signal });
}

export function fetchChatReportDetail(reportId: string, signal?: AbortSignal): Promise<ChatReportDetail> {
  return sendAdminApiRequest(`/admin/chat-reports/${encodeURIComponent(reportId)}`, { signal });
}

export function applyActionToChatReport(reportId: string, input: { action: ChatReportAction; reason: string; durationDays?: number }): Promise<ChatReportDetail> {
  return sendAdminApiRequest(`/admin/chat-reports/${encodeURIComponent(reportId)}/actions`, { method: "POST", body: input });
}

export function fetchChatEvidenceRetention(signal?: AbortSignal): Promise<ChatEvidenceRetentionSettings> {
  return sendAdminApiRequest("/admin/chat-reports/retention", { signal });
}

export function updateChatEvidenceRetention(input: { retentionDays: number; reason: string }): Promise<ChatEvidenceRetentionSettings> {
  return sendAdminApiRequest("/admin/chat-reports/retention", { method: "PUT", body: input });
}
