import type { AdminPermission } from "@/constants/adminPermissions.constant";
import { sendAdminApiRequest } from "@/services/adminApiClient.service";
import type { AdminAccountSummary, AdminActiveSession, AdminPasskey, AdminRole, AdminRoleDefinition, StaffSettings } from "@/types/admin.type";
import type { PagedList } from "@/types/api.type";
import type { AuditLogEntry } from "@/types/audit.type";
import type { MetricsRange, OverviewMetrics } from "@/types/metrics.type";

export function fetchOverviewMetrics(range: MetricsRange, signal?: AbortSignal): Promise<OverviewMetrics> {
  return sendAdminApiRequest("/admin/metrics/overview", { query: { range }, signal });
}

export interface AdminListFilters {
  readonly search?: string;
  readonly status?: string;
  readonly role?: string;
  readonly cursor?: string;
}

export function fetchAdminAccounts(filters: AdminListFilters, signal?: AbortSignal): Promise<PagedList<AdminAccountSummary>> {
  return sendAdminApiRequest("/admin/admins", { query: { ...filters }, signal });
}

export function fetchAdminAccountDetail(adminId: string, signal?: AbortSignal): Promise<{ admin: AdminAccountSummary; activeSessionCount: number; lastActions: AuditLogEntry[]; history: AuditLogEntry[] }> {
  return sendAdminApiRequest(`/admin/admins/${encodeURIComponent(adminId)}`, { signal });
}

export interface CreateAdminInput {
  readonly email: string;
  readonly name: string;
  readonly role: AdminRole;
  readonly roleIds: readonly string[];
  readonly permissions: readonly AdminPermission[];
  readonly reason: string;
}

export function createAdminAccount(input: CreateAdminInput): Promise<{ admin: AdminAccountSummary; invitationSentTo: string; invitationExpiresInHours: number }> {
  return sendAdminApiRequest("/admin/admins", { method: "POST", body: input });
}

export function replaceAdminPermissions(adminId: string, input: { role: Exclude<AdminRole, "SUPERADMIN">; roleIds: readonly string[]; permissions: readonly AdminPermission[]; reason: string }): Promise<{ admin: AdminAccountSummary }> {
  return sendAdminApiRequest(`/admin/admins/${encodeURIComponent(adminId)}/permissions`, { method: "PUT", body: input });
}

export function changeAdminAccountState(adminId: string, action: "disable" | "enable" | "reset-mfa" | "suspend" | "revoke" | "approve", reason: string): Promise<{ admin: AdminAccountSummary }> {
  return sendAdminApiRequest(`/admin/admins/${encodeURIComponent(adminId)}/${action}`, { method: "POST", body: { reason } });
}

export interface AuditLogFilters {
  readonly search?: string;
  readonly area?: string;
  readonly actorId?: string;
  readonly targetType?: string;
  readonly targetId?: string;
  readonly from?: string;
  readonly to?: string;
  readonly cursor?: string;
}

export function fetchAuditLog(filters: AuditLogFilters, signal?: AbortSignal): Promise<PagedList<AuditLogEntry>> {
  return sendAdminApiRequest("/admin/audit", { query: { ...filters, pageSize: 50 }, signal });
}

export function fetchAuditFacets(signal?: AbortSignal): Promise<{ areas: string[]; actors: { id: string; name: string }[] }> {
  return sendAdminApiRequest("/admin/audit/facets", { signal });
}

export function downloadAuditLogCsv(filters: AuditLogFilters): Promise<Blob> {
  return sendAdminApiRequest("/admin/audit/export", { query: { ...filters, format: "csv" }, expect: "blob" });
}

export function fetchOwnAdminAccount(signal?: AbortSignal): Promise<{ account: AdminAccountSummary; recoveryCodesRemaining: number; passkeys: AdminPasskey[] }> {
  return sendAdminApiRequest("/admin/account", { signal });
}

export function fetchOwnAdminSessions(signal?: AbortSignal): Promise<{ items: AdminActiveSession[] }> {
  return sendAdminApiRequest("/admin/account/sessions", { signal });
}

export function revokeOwnAdminSession(sessionId: string): Promise<void> {
  return sendAdminApiRequest(`/admin/account/sessions/${encodeURIComponent(sessionId)}/revoke`, { method: "POST" });
}

export function regenerateOwnRecoveryCodes(): Promise<{ recoveryCodes: string[] }> {
  return sendAdminApiRequest("/admin/account/recovery-codes/regenerate", { method: "POST" });
}

export function fetchPasskeyCreationOptions<Options>(): Promise<Options> {
  return sendAdminApiRequest("/admin/account/passkeys/options", { method: "POST" });
}

export function registerOwnPasskey(label: string, credential: Record<string, unknown>): Promise<AdminPasskey> {
  return sendAdminApiRequest("/admin/account/passkeys", { method: "POST", body: { label, credential } });
}

export function removeOwnPasskey(passkeyId: string): Promise<void> {
  return sendAdminApiRequest(`/admin/account/passkeys/${encodeURIComponent(passkeyId)}`, { method: "DELETE" });
}

export function fetchAdminRoles(signal?: AbortSignal): Promise<{ items: AdminRoleDefinition[] }> {
  return sendAdminApiRequest("/admin/roles", { signal });
}

export function createCustomAdminRole(input: { name: string; permissions: readonly AdminPermission[]; reason: string }): Promise<AdminRoleDefinition> {
  return sendAdminApiRequest("/admin/roles", { method: "POST", body: input });
}

export function fetchStaffSettings(signal?: AbortSignal): Promise<StaffSettings> {
  return sendAdminApiRequest("/admin/staff-settings", { signal });
}

export function saveStaffSettings(input: StaffSettings & { reason: string }): Promise<StaffSettings> {
  return sendAdminApiRequest("/admin/staff-settings", { method: "PUT", body: input });
}
