import { sendAdminApiRequest } from "@/services/adminApiClient.service";
import type { LinkedProfilesSummary } from "@/types/linkedProfiles.type";

export function fetchLinkedProfiles(userId: string, signal?: AbortSignal): Promise<LinkedProfilesSummary> {
  return sendAdminApiRequest(`/admin/users/${encodeURIComponent(userId)}/linked-profiles`, { signal });
}

export function fetchLinkedProfileConflicts(signal?: AbortSignal): Promise<{ data: LinkedProfilesSummary[]; nextCursor: string | null }> {
  return sendAdminApiRequest("/admin/linked-profiles/conflicts", { signal });
}

export function convertLinkedProfile(userId: string, input: { profileId: string; toKind: "store" | "business"; reason: string }): Promise<LinkedProfilesSummary> {
  return sendAdminApiRequest(`/admin/users/${encodeURIComponent(userId)}/linked-profiles/convert`, { method: "POST", body: input });
}

export function resolveLinkedProfiles(userId: string, input: { keep: readonly string[]; reason: string }): Promise<LinkedProfilesSummary> {
  return sendAdminApiRequest(`/admin/users/${encodeURIComponent(userId)}/linked-profiles/resolve`, { method: "POST", body: input });
}

export function reassignBrandOwner(brandId: string, input: { toAccountId: string; reason: string }): Promise<{ brandId: string; ownerAccountId: string }> {
  return sendAdminApiRequest(`/admin/brands/${encodeURIComponent(brandId)}/reassign`, { method: "POST", body: input });
}
