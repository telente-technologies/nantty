import { sendAdminApiRequest } from "@/services/adminApiClient.service";
import type { PagedList } from "@/types/api.type";
import type { CopyrightClaimDetail, CopyrightClaimSummary } from "@/types/copyright.type";
import type { AppealDetail, AppealSummary, ContentModerationAction, ReportDetail, ReportSummary } from "@/types/moderation.type";

export interface ReportQueueFilters {
  readonly status?: string;
  readonly targetType?: string;
  readonly reason?: string;
  readonly priority?: string;
  readonly search?: string;
  readonly cursor?: string;
}

export function fetchModerationReports(filters: ReportQueueFilters, signal?: AbortSignal): Promise<PagedList<ReportSummary>> {
  return sendAdminApiRequest("/admin/reports", { query: { ...filters }, signal });
}

export function fetchModerationReportDetail(reportId: string, signal?: AbortSignal): Promise<ReportDetail> {
  return sendAdminApiRequest(`/admin/reports/${encodeURIComponent(reportId)}`, { signal });
}

export function applyContentActionToReport(reportId: string, action: ContentModerationAction, reason: string): Promise<ReportDetail> {
  return sendAdminApiRequest(`/admin/reports/${encodeURIComponent(reportId)}/actions`, { method: "POST", body: { action, reason } });
}

export function suspendReportedAuthor(reportId: string, durationDays: number, reason: string): Promise<ReportDetail> {
  return sendAdminApiRequest(`/admin/reports/${encodeURIComponent(reportId)}/suspend-author`, { method: "POST", body: { durationDays, reason } });
}

export function revokeReportedAuthorVerification(reportId: string, reason: string): Promise<ReportDetail> {
  return sendAdminApiRequest(`/admin/reports/${encodeURIComponent(reportId)}/revoke-author-verification`, { method: "POST", body: { reason } });
}

export interface AppealQueueFilters {
  readonly status?: string;
  readonly decisionType?: string;
  readonly search?: string;
  readonly cursor?: string;
}

export function fetchModerationAppeals(filters: AppealQueueFilters, signal?: AbortSignal): Promise<PagedList<AppealSummary>> {
  return sendAdminApiRequest("/admin/appeals", { query: { ...filters }, signal });
}

export function fetchModerationAppealDetail(appealId: string, signal?: AbortSignal): Promise<AppealDetail> {
  return sendAdminApiRequest(`/admin/appeals/${encodeURIComponent(appealId)}`, { signal });
}

export function decideModerationAppeal(appealId: string, outcome: "UPHELD" | "OVERTURNED", reason: string): Promise<AppealDetail> {
  return sendAdminApiRequest(`/admin/appeals/${encodeURIComponent(appealId)}/decide`, { method: "POST", body: { outcome, reason } });
}

export interface CopyrightClaimFilters {
  readonly status?: string;
  readonly workType?: string;
  readonly search?: string;
  readonly cursor?: string;
}

export function fetchCopyrightClaims(filters: CopyrightClaimFilters, signal?: AbortSignal): Promise<PagedList<CopyrightClaimSummary>> {
  return sendAdminApiRequest("/admin/copyright-claims", { query: { ...filters }, signal });
}

export function fetchCopyrightClaimDetail(claimId: string, signal?: AbortSignal): Promise<CopyrightClaimDetail> {
  return sendAdminApiRequest(`/admin/copyright-claims/${encodeURIComponent(claimId)}`, { signal });
}

export type CopyrightClaimDecision = "uphold" | "reject" | "request-info";

export function decideCopyrightClaim(claimId: string, decision: CopyrightClaimDecision, reason: string): Promise<CopyrightClaimDetail> {
  return sendAdminApiRequest(`/admin/copyright-claims/${encodeURIComponent(claimId)}/${decision}`, { method: "POST", body: { reason } });
}

export function decideCounterNotice(claimId: string, noticeId: string, decision: "accept" | "reject", reason: string): Promise<CopyrightClaimDetail> {
  return sendAdminApiRequest(`/admin/copyright-claims/${encodeURIComponent(claimId)}/counter-notices/${encodeURIComponent(noticeId)}/${decision}`, { method: "POST", body: { reason } });
}
