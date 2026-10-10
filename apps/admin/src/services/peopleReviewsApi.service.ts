import { sendAdminApiRequest } from "@/services/adminApiClient.service";
import type { PagedList } from "@/types/api.type";
import type { ApplicationKind, ProgramApplication, ProgramApplicationDetail } from "@/types/applications.type";
import type { VerificationApplication, VerificationApplicationDetail, VerificationDocumentAccess, VerificationListFilters, VerificationTransition } from "@/types/verification.type";

const verificationPath = (verificationId: string, suffix = "") => `/admin/verifications/${encodeURIComponent(verificationId)}${suffix}`;

export function fetchVerificationApplications(filters: VerificationListFilters, signal?: AbortSignal): Promise<PagedList<VerificationApplication>> {
  return sendAdminApiRequest("/admin/verifications", { query: { ...filters }, signal });
}

export function fetchVerificationApplicationDetail(verificationId: string, signal?: AbortSignal): Promise<VerificationApplicationDetail> {
  return sendAdminApiRequest(verificationPath(verificationId), { signal });
}

export function openVerificationDocument(verificationId: string, documentId: string): Promise<VerificationDocumentAccess> {
  return sendAdminApiRequest(verificationPath(verificationId, `/documents/${encodeURIComponent(documentId)}`));
}

export function applyVerificationTransition(verificationId: string, transition: VerificationTransition, reason: string): Promise<VerificationApplicationDetail> {
  return sendAdminApiRequest(verificationPath(verificationId, `/${transition}`), { method: "POST", body: { reason } });
}

export function fetchProgramApplications(kind: ApplicationKind, filters: { status?: string; search?: string; cursor?: string }, signal?: AbortSignal): Promise<PagedList<ProgramApplication>> {
  return sendAdminApiRequest(`/admin/applications/${kind}`, { query: { ...filters }, signal });
}

export function fetchProgramApplicationDetail(kind: ApplicationKind, applicationId: string, signal?: AbortSignal): Promise<ProgramApplicationDetail> {
  return sendAdminApiRequest(`/admin/applications/${kind}/${encodeURIComponent(applicationId)}`, { signal });
}

export function decideProgramApplication(kind: ApplicationKind, applicationId: string, decision: "approve" | "reject", reason: string): Promise<ProgramApplicationDetail> {
  return sendAdminApiRequest(`/admin/applications/${kind}/${encodeURIComponent(applicationId)}/${decision}`, { method: "POST", body: { reason } });
}
