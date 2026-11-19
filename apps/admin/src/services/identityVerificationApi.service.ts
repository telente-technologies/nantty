import { sendAdminApiRequest } from "@/services/adminApiClient.service";
import type { IdentityCaseDecision, IdentityCaseDetail, IdentityCaseListItem, IdentityCaseStatus } from "@/types/identityVerification.type";

export function fetchIdentityCases(status: IdentityCaseStatus, signal?: AbortSignal): Promise<{ readonly data: readonly IdentityCaseListItem[] }> {
  return sendAdminApiRequest("/admin/verification-cases", { query: { status }, signal });
}

export function fetchIdentityCaseDetail(caseId: string, signal?: AbortSignal): Promise<IdentityCaseDetail> {
  return sendAdminApiRequest(`/admin/verification-cases/${encodeURIComponent(caseId)}`, { signal });
}

export function decideIdentityCase(caseId: string, decision: IdentityCaseDecision, reason: string): Promise<IdentityCaseDetail["case"]> {
  return sendAdminApiRequest(`/admin/verification-cases/${encodeURIComponent(caseId)}/${decision}`, { method: "POST", body: { reason } });
}

export function replayIdentityCaseCallback(caseId: string, jobId: string, reason: string): Promise<{ readonly accepted: boolean; readonly message: string }> {
  return sendAdminApiRequest(`/admin/verification-cases/${encodeURIComponent(caseId)}/replay-callback`, { method: "POST", body: { jobId, reason } });
}
