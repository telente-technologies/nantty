import { sendAdminApiRequest } from "@/services/adminApiClient.service";
import type { AdForReview, AdForReviewDetail, AdFrequencyPolicy, AdPoliciesDocument, AdPolicyCategory, AdvertiserAccount, AdvertiserAccountDetail, PolicySeverity } from "@/types/adsReview.type";
import type { PagedList } from "@/types/api.type";

export function fetchAdsForReview(filters: { status?: string; search?: string; advertiserId?: string; page?: number }, signal?: AbortSignal): Promise<PagedList<AdForReview>> {
  return sendAdminApiRequest("/admin/ads", { query: { ...filters }, signal });
}

export function fetchAdForReviewDetail(adId: string, signal?: AbortSignal): Promise<AdForReviewDetail> {
  return sendAdminApiRequest(`/admin/ads/${encodeURIComponent(adId)}`, { signal });
}

export function approveAdAfterReview(adId: string, reason: string, overrideCriticalFlags: boolean): Promise<AdForReviewDetail> {
  return sendAdminApiRequest(`/admin/ads/${encodeURIComponent(adId)}/approve`, { method: "POST", body: { reason: reason || undefined, overrideCriticalFlags } });
}

export function rejectAdForPolicy(adId: string, policyCategoryId: string, reason: string): Promise<AdForReviewDetail> {
  return sendAdminApiRequest(`/admin/ads/${encodeURIComponent(adId)}/reject`, { method: "POST", body: { policyCategoryId, reason } });
}

export function resolveAdAppeal(adId: string, decision: "uphold" | "overturn", note: string): Promise<AdForReviewDetail> {
  return sendAdminApiRequest(`/admin/ads/${encodeURIComponent(adId)}/appeal/resolve`, { method: "POST", body: { decision, note } });
}

export function fetchAdFrequencyPolicies(signal?: AbortSignal): Promise<AdPoliciesDocument> {
  return sendAdminApiRequest("/admin/ads-policies", { signal });
}

export function updateAdFrequencyPolicy(format: string, policy: AdFrequencyPolicy): Promise<void> {
  return sendAdminApiRequest(`/admin/ads-policies/frequency/${encodeURIComponent(format)}`, { method: "PUT", body: policy });
}

export function fetchAdvertiserAccounts(filters: { status?: string; search?: string; page?: number }, signal?: AbortSignal): Promise<PagedList<AdvertiserAccount>> {
  return sendAdminApiRequest("/admin/advertisers", { query: { ...filters }, signal });
}

export function fetchAdvertiserAccountDetail(advertiserId: string, signal?: AbortSignal): Promise<AdvertiserAccountDetail> {
  return sendAdminApiRequest(`/admin/advertisers/${encodeURIComponent(advertiserId)}`, { signal });
}

export function changeAdvertiserAccountStatus(advertiserId: string, action: "suspend" | "reinstate", reason: string): Promise<AdvertiserAccountDetail> {
  return sendAdminApiRequest(`/admin/advertisers/${encodeURIComponent(advertiserId)}/${action}`, { method: "POST", body: { reason } });
}

export function fetchAdPolicyCategories(signal?: AbortSignal): Promise<{ items: AdPolicyCategory[] }> {
  return sendAdminApiRequest("/admin/ad-policies", { signal });
}

export interface AdPolicyCategoryInput {
  readonly name: string;
  readonly description: string;
  readonly severity: PolicySeverity;
}

export function createAdPolicyCategory(input: AdPolicyCategoryInput): Promise<AdPolicyCategory> {
  return sendAdminApiRequest("/admin/ad-policies", { method: "POST", body: input });
}

export function updateAdPolicyCategory(policyId: string, input: AdPolicyCategoryInput & { isActive: boolean; reason: string }): Promise<AdPolicyCategory> {
  return sendAdminApiRequest(`/admin/ad-policies/${encodeURIComponent(policyId)}`, { method: "PUT", body: input });
}
