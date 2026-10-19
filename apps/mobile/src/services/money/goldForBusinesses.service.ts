import type { GoldCoverageChange, GoldCoverageChangeInput, GoldForBusinessesOverview, GoldForBusinessesQuote, GoldForBusinessesQuoteInput } from "@/types/goldForBusinesses.type";

import { api } from "../core/apiClient.service";

export const goldForBusinessesService = {
  fetchGoldForBusinesses: () => api.get<GoldForBusinessesOverview>("/api/v1/subscriptions/gold-for-businesses"),
  quoteGoldForBusinesses: (input: GoldForBusinessesQuoteInput) => api.post<GoldForBusinessesQuote>("/api/v1/subscriptions/gold-for-businesses/quote", input),
  changeCoveredBusinesses: (subscriptionId: string, input: GoldCoverageChangeInput, idempotencyKey: string) =>
    api.put<GoldCoverageChange>(`/api/v1/subscriptions/gold-for-businesses/${encodeURIComponent(subscriptionId)}/profiles`, input, { idempotencyKey }),
};
