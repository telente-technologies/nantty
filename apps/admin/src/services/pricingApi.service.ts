import { sendAdminApiRequest } from "@/services/adminApiClient.service";
import type { CoinPackPriceRow, PlanPriceRow, PlanPriceTable } from "@/types/regionalPricing.type";

export function fetchPlanPriceTable(signal?: AbortSignal): Promise<PlanPriceTable> {
  return sendAdminApiRequest("/admin/subscriptions/price-table", { signal });
}

export function savePlanPriceRow(row: PlanPriceRow, reason: string): Promise<PlanPriceRow> {
  const { planCode, countryCode, updatedByStaffId: _ignored, nextEffectiveFrom: _nextEffectiveFrom, history: _history, ...body } = row;
  return sendAdminApiRequest(`/admin/subscriptions/price-table/${encodeURIComponent(planCode)}/${encodeURIComponent(countryCode)}`, { method: "PUT", body: { ...body, reason } });
}

export function fetchCoinPackPriceTable(signal?: AbortSignal): Promise<{ data: CoinPackPriceRow[] }> {
  return sendAdminApiRequest("/admin/coins/price-table", { signal });
}

export function saveCoinPackPriceRow(row: CoinPackPriceRow, reason: string): Promise<CoinPackPriceRow> {
  const { id, ...body } = row;
  return sendAdminApiRequest(`/admin/coins/price-table/${encodeURIComponent(id)}`, { method: "PUT", body: { ...body, reason } });
}
