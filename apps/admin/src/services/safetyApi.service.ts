import { sendAdminApiRequest } from "@/services/adminApiClient.service";
import type { AdminCreatedAccount, CheckmarkGrant, CreateAccountInput, GrantCheckmarkInput } from "@/types/accountsAdmin.type";
import type { AdminGovernmentBlackSummary, BlackAppeal, BlackApplication, BlackChecklistKey } from "@/types/blackApplications.type";
import type { BusinessDocumentAccess, BusinessDocumentFilters, BusinessDocumentSubmission } from "@/types/businessDocuments.type";
import type { PagedList } from "@/types/api.type";
import type { SuspendedAccount, SuspendedAccountFilters, SuspensionCaseDetail, SuspensionCaseSummary, SuspensionQueueFilters, SuspensionReasonCode } from "@/types/suspensions.type";

export function fetchSuspensionCases(filters: SuspensionQueueFilters, signal?: AbortSignal): Promise<PagedList<SuspensionCaseSummary>> {
  return sendAdminApiRequest("/admin/suspensions/cases", { query: { ...filters }, signal });
}

export function fetchSuspensionCaseDetail(caseId: string, signal?: AbortSignal): Promise<SuspensionCaseDetail> {
  return sendAdminApiRequest(`/admin/suspensions/cases/${encodeURIComponent(caseId)}`, { signal });
}

export type SuspensionCaseDecision = "approve" | "dismiss" | "escalate";

export function decideSuspensionCase(caseId: string, decision: SuspensionCaseDecision, input: { reason: string; reasonCode?: SuspensionReasonCode }): Promise<SuspensionCaseDetail> {
  return sendAdminApiRequest(`/admin/suspensions/cases/${encodeURIComponent(caseId)}/${decision}`, { method: "POST", body: input });
}

export function fetchSuspendedAccounts(filters: SuspendedAccountFilters, signal?: AbortSignal): Promise<PagedList<SuspendedAccount>> {
  return sendAdminApiRequest("/admin/suspensions/accounts", { query: { ...filters }, signal });
}

export function reinstateSuspendedAccount(caseId: string, reason: string): Promise<{ reinstated: true }> {
  return sendAdminApiRequest(`/admin/suspensions/accounts/${encodeURIComponent(caseId)}/reinstate`, { method: "POST", body: { reason } });
}

export function decideSuspensionAppeal(caseId: string, outcome: "UPHELD" | "OVERTURNED", reason: string): Promise<{ outcome: string }> {
  return sendAdminApiRequest(`/admin/suspensions/accounts/${encodeURIComponent(caseId)}/appeal/decide`, { method: "POST", body: { outcome, reason } });
}

export function fetchAdminCreatedAccounts(signal?: AbortSignal): Promise<PagedList<AdminCreatedAccount>> {
  return sendAdminApiRequest("/admin/accounts/created", { signal });
}

export function createAccountAsAdmin(input: CreateAccountInput): Promise<AdminCreatedAccount> {
  return sendAdminApiRequest("/admin/accounts", { method: "POST", body: input });
}

export function fetchCheckmarkGrants(status: "ACTIVE" | "REVOKED", signal?: AbortSignal): Promise<PagedList<CheckmarkGrant>> {
  return sendAdminApiRequest("/admin/checkmark-grants", { query: { status }, signal });
}

export function grantLifetimeCheckmark(input: GrantCheckmarkInput): Promise<CheckmarkGrant> {
  return sendAdminApiRequest("/admin/checkmark-grants", { method: "POST", body: input });
}

export function revokeLifetimeCheckmark(grantId: string, reason: string): Promise<CheckmarkGrant> {
  return sendAdminApiRequest(`/admin/checkmark-grants/${encodeURIComponent(grantId)}/revoke`, { method: "POST", body: { reason } });
}

export function fetchBusinessDocumentSubmissions(filters: BusinessDocumentFilters, signal?: AbortSignal): Promise<PagedList<BusinessDocumentSubmission>> {
  return sendAdminApiRequest("/admin/business-documents", { query: { ...filters }, signal });
}

export function openBusinessDocument(submissionId: string, documentId: string, signal?: AbortSignal): Promise<BusinessDocumentAccess> {
  return sendAdminApiRequest(`/admin/business-documents/${encodeURIComponent(submissionId)}/documents/${encodeURIComponent(documentId)}/access`, { signal });
}

export function reviewBusinessDocument(submissionId: string, documentId: string, decision: "approve" | "reject", reason: string): Promise<BusinessDocumentSubmission> {
  return sendAdminApiRequest(`/admin/business-documents/${encodeURIComponent(submissionId)}/documents/${encodeURIComponent(documentId)}/${decision}`, { method: "POST", body: { reason } });
}

const blackPath = (applicationId: string, suffix: string) => `/admin/black-applications/${encodeURIComponent(applicationId)}/${suffix}`;

export function fetchBlackApplications(filters: { status: string; search?: string; cursor?: string }, signal?: AbortSignal): Promise<PagedList<BlackApplication>> {
  return sendAdminApiRequest("/admin/black-applications", { query: { ...filters }, signal });
}

export function updateBlackChecklistItem(applicationId: string, input: { key: BlackChecklistKey; isVerified: boolean; note?: string }): Promise<BlackApplication> {
  return sendAdminApiRequest(blackPath(applicationId, "checklist"), { method: "POST", body: input });
}

export function decideBlackApplication(applicationId: string, action: "approve" | "reject" | "revoke" | "require-reverification", reason: string): Promise<BlackApplication> {
  return sendAdminApiRequest(blackPath(applicationId, action), { method: "POST", body: { reason } });
}

export function sendBlackReverificationReminder(applicationId: string): Promise<BlackApplication> {
  return sendAdminApiRequest(blackPath(applicationId, "reverification-reminder"), { method: "POST", body: {} });
}

export function updateBlackCheckoutAuthorization(applicationId: string, input: { enabled: boolean; expiresInHours?: number; reason: string }): Promise<BlackApplication> {
  return sendAdminApiRequest(blackPath(applicationId, "checkout-authorization"), { method: "POST", body: input });
}

export function fetchBlackAppeals(applicationId?: string, signal?: AbortSignal): Promise<PagedList<BlackAppeal>> {
  return sendAdminApiRequest("/admin/black-applications/appeals", { query: applicationId ? { applicationId } : {}, signal });
}

export function decideBlackAppeal(appealId: string, input: { decision: "reopen_review" | "uphold"; note: string }): Promise<BlackAppeal> {
  return sendAdminApiRequest(`/admin/black-applications/appeals/${encodeURIComponent(appealId)}/decide`, { method: "POST", body: input });
}

export function fetchAdminGovernmentBlack(signal?: AbortSignal): Promise<PagedList<AdminGovernmentBlackSummary>> {
  return sendAdminApiRequest("/admin/subscriptions/government-black", { signal });
}

export function controlAdminGovernmentBlack(subscriptionId: string, action: "pause" | "cancel" | "retry" | "reconcile", reason?: string): Promise<unknown> {
  return sendAdminApiRequest(`/admin/subscriptions/government-black/${encodeURIComponent(subscriptionId)}/${action}`, {
    method: "POST",
    body: reason ? { reason } : {},
  });
}
