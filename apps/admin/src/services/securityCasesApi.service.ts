import { sendAdminApiRequest } from "@/services/adminApiClient.service";
import type { PagedList } from "@/types/api.type";
import type { SecurityCaseDecisionInput, SecurityCaseDetail, SecurityCaseFilters, SecurityCaseSummary } from "@/types/securityCases.type";

export function fetchSecurityCases(filters: SecurityCaseFilters, signal?: AbortSignal): Promise<PagedList<SecurityCaseSummary>> {
  return sendAdminApiRequest("/admin/security/cases", { query: { ...filters }, signal });
}

export function fetchSecurityCaseDetail(caseId: string, signal?: AbortSignal): Promise<SecurityCaseDetail> {
  return sendAdminApiRequest(`/admin/security/cases/${encodeURIComponent(caseId)}`, { signal });
}

export function decideSecurityCase(caseId: string, input: SecurityCaseDecisionInput): Promise<SecurityCaseDetail> {
  return sendAdminApiRequest(`/admin/security/cases/${encodeURIComponent(caseId)}/decide`, { method: "POST", body: input });
}
