import { sendAdminApiRequest } from "@/services/adminApiClient.service";

export interface AdminDeveloperApplication {
  readonly id: string;
  readonly organizationId: string;
  readonly organizationName: string;
  readonly name: string;
  readonly apiProduct: string;
  readonly status: string;
  readonly createdAt: string;
}

export function fetchDeveloperApplications(status?: string, signal?: AbortSignal): Promise<{ readonly applications: readonly AdminDeveloperApplication[] }> {
  return sendAdminApiRequest("/admin/developer/applications", { query: status ? { status } : undefined, signal });
}

export function reviewDeveloperApplication(
  applicationId: string,
  decision: "approved" | "rejected" | "suspended",
  reason: string,
): Promise<{ readonly id: string; readonly status: string }> {
  return sendAdminApiRequest(`/admin/developer/applications/${encodeURIComponent(applicationId)}/review`, { method: "POST", body: { decision, reason } });
}

export function updateDeveloperOrganizationQuota(
  organizationId: string,
  monthlyQuota: number,
): Promise<{ readonly organizationId: string; readonly planTier: string; readonly status: string; readonly monthlyQuota: number }> {
  return sendAdminApiRequest(`/admin/developer/organizations/${encodeURIComponent(organizationId)}/quota`, { method: "PATCH", body: { monthlyQuota } });
}
