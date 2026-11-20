import type { AccountHealthSummary } from "@/types/accountHealth.type";
import type { CopyrightClaimDetail, CopyrightPolicySettings } from "@/types/copyright.type";

import { sendAdminApiRequest } from "@/services/adminApiClient.service";

export function fetchCopyrightPolicy(signal?: AbortSignal): Promise<CopyrightPolicySettings> {
  return sendAdminApiRequest("/admin/copyright-policy", { signal });
}

export function updateCopyrightPolicy(settings: CopyrightPolicySettings, reason: string): Promise<CopyrightPolicySettings> {
  return sendAdminApiRequest("/admin/copyright-policy", { method: "PUT", body: { ...settings, updatedBy: undefined, updatedAt: undefined, reason } });
}

export function fetchAccountHealth(userId: string, signal?: AbortSignal): Promise<AccountHealthSummary> {
  return sendAdminApiRequest(`/admin/account-health/${encodeURIComponent(userId)}`, { signal });
}

export function decideStrikeAppeal(strikeId: string, decision: "uphold" | "overturn", reason: string): Promise<{ status: string }> {
  return sendAdminApiRequest(`/admin/strike-appeals/${encodeURIComponent(strikeId)}/${decision}`, { method: "POST", body: { reason } });
}

export function runCopyrightAudioMatch(claimId: string): Promise<CopyrightClaimDetail> {
  return sendAdminApiRequest(`/admin/copyright-claims/${encodeURIComponent(claimId)}/audio-match`, { method: "POST", body: {} });
}

export function setMonetisationOverride(userId: string, mode: "ALLOW" | "PAUSE", reason: string): Promise<AccountHealthSummary> {
  return sendAdminApiRequest(`/admin/account-health/${encodeURIComponent(userId)}/monetisation-override`, { method: "PUT", body: { mode, reason } });
}

export function clearMonetisationOverride(userId: string, reason: string): Promise<AccountHealthSummary> {
  return sendAdminApiRequest(`/admin/account-health/${encodeURIComponent(userId)}/monetisation-override`, { method: "DELETE", body: { reason } });
}
