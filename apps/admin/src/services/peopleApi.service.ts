import { sendAdminApiRequest } from "@/services/adminApiClient.service";
import type { PagedList } from "@/types/api.type";
import type { UserDetail, UserListFilters, UserPersonalDataResponse, UsernameWithholdResult, WithheldUsername } from "@/types/peopleUsers.type";
import type { PlatformUserSummary } from "@/types/platformUser.type";
import type { ConfusablePreview, ReservedUsernameCategory, ReservedUsernameEntry, ReservedUsernameKind } from "@/types/usernames.type";

const userPath = (userId: string, suffix = "") => `/admin/users/${encodeURIComponent(userId)}${suffix}`;

export function fetchPlatformUsers(filters: UserListFilters, signal?: AbortSignal): Promise<PagedList<PlatformUserSummary>> {
  return sendAdminApiRequest("/admin/users", { query: { ...filters }, signal });
}

export function fetchPlatformUserDetail(userId: string, signal?: AbortSignal): Promise<UserDetail> {
  return sendAdminApiRequest(userPath(userId), { signal });
}

export function revealPlatformUserPersonalData(userId: string, purpose: string): Promise<UserPersonalDataResponse> {
  return sendAdminApiRequest(userPath(userId, "/personal-data"), { query: { purpose } });
}

export function warnPlatformUser(userId: string, input: { reason: string; policy: string; addStrike: boolean }): Promise<UserDetail> {
  return sendAdminApiRequest(userPath(userId, "/warn"), { method: "POST", body: input });
}

export function suspendPlatformUser(userId: string, input: { reason: string; durationDays: number }): Promise<UserDetail> {
  return sendAdminApiRequest(userPath(userId, "/suspend"), { method: "POST", body: input });
}

export function reinstatePlatformUser(userId: string, reason: string): Promise<UserDetail> {
  return sendAdminApiRequest(userPath(userId, "/reinstate"), { method: "POST", body: { reason } });
}

export function banPlatformUser(userId: string, input: { reason: string; durationDays: number | null }): Promise<UserDetail> {
  return sendAdminApiRequest(userPath(userId, "/ban"), { method: "POST", body: input });
}

export function unbanPlatformUser(userId: string, reason: string): Promise<UserDetail> {
  return sendAdminApiRequest(userPath(userId, "/unban"), { method: "POST", body: { reason } });
}

export function forceLogoutPlatformUser(userId: string, input: { reason: string; sessionId?: string }): Promise<UserDetail> {
  return sendAdminApiRequest(userPath(userId, "/force-logout"), { method: "POST", body: input });
}

export function withholdPlatformUsername(userId: string, reason: string): Promise<UsernameWithholdResult> {
  return sendAdminApiRequest(userPath(userId, "/username/withhold"), { method: "POST", body: { reason } });
}

export function reclaimWithheldUsername(userId: string, input: { reason: string; mode: "RESTORE_TO_OWNER" | "ASSIGN_TO_CLAIMANT"; claimantUserId?: string }): Promise<UserDetail> {
  return sendAdminApiRequest(userPath(userId, "/username/reclaim"), { method: "POST", body: input });
}

export function fetchWithheldUsernames(signal?: AbortSignal): Promise<{ items: WithheldUsername[] }> {
  return sendAdminApiRequest("/admin/usernames/withheld", { signal });
}

export function previewUsernameConfusables(candidate: string, signal?: AbortSignal): Promise<ConfusablePreview> {
  return sendAdminApiRequest("/admin/usernames/confusables", { query: { candidate }, signal });
}

export function fetchReservedUsernames(filters: { search?: string; kind?: string; category?: string }, signal?: AbortSignal): Promise<{ items: ReservedUsernameEntry[] }> {
  return sendAdminApiRequest("/admin/reserved-usernames", { query: { ...filters }, signal });
}

export function addReservedUsername(input: { value: string; kind: ReservedUsernameKind; category: ReservedUsernameCategory; note: string; reason: string }): Promise<{ entry: ReservedUsernameEntry; existingAccountsMatching: string[] }> {
  return sendAdminApiRequest("/admin/reserved-usernames", { method: "POST", body: input });
}

export function removeReservedUsername(entryId: string, reason: string): Promise<void> {
  return sendAdminApiRequest(`/admin/reserved-usernames/${encodeURIComponent(entryId)}/remove`, { method: "POST", body: { reason } });
}
