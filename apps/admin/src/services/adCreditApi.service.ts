import { sendAdminApiRequest } from "@/services/adminApiClient.service";
import type { AdCashbackSetting, AdCashbackSettingPage, AdCreditGrant, AdCreditGrantFilters, AdCreditGrantPage, IssueAdCreditInput, SaveAdCashbackInput } from "@/types/adCredit.type";

export function fetchIssuedAdCredits(filters: AdCreditGrantFilters, signal?: AbortSignal): Promise<AdCreditGrantPage> {
  return sendAdminApiRequest("/admin/ads/credits", { query: { ...filters }, signal });
}

export function issueAdCreditToUser(input: IssueAdCreditInput): Promise<AdCreditGrant> {
  const { idempotencyKey, ...body } = input;
  return sendAdminApiRequest("/admin/ads/credits", { method: "POST", body, idempotencyKey });
}

export function revokeUnspentAdCredit(input: { readonly creditId: string; readonly reason: string; readonly idempotencyKey: string }): Promise<AdCreditGrant> {
  return sendAdminApiRequest(`/admin/ads/credits/${encodeURIComponent(input.creditId)}/revoke`, { method: "POST", body: { reason: input.reason }, idempotencyKey: input.idempotencyKey });
}

export function fetchAdCashbackSettings(cursor: string | undefined, signal?: AbortSignal): Promise<AdCashbackSettingPage> {
  return sendAdminApiRequest("/admin/ads/cashback", { query: { cursor }, signal });
}

export function saveAdCashbackSettingForUser(input: SaveAdCashbackInput): Promise<AdCashbackSetting> {
  const { userId, idempotencyKey, ...body } = input;
  return sendAdminApiRequest(`/admin/ads/cashback/${encodeURIComponent(userId)}`, { method: "PUT", body, idempotencyKey });
}
