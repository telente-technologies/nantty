import { keepPreviousData, useQuery } from "@tanstack/react-query";

import { goldForBusinessesService } from "@/services/money/goldForBusinesses.service";
import type { GoldForBusinessesInterval } from "@/types/goldForBusinesses.type";

export const goldForBusinessesQueryKeys = {
  overview: ["subscriptions", "gold-for-businesses"] as const,
  quote: (profileIds: readonly string[], interval: GoldForBusinessesInterval) => ["subscriptions", "gold-for-businesses", "quote", [...profileIds].sort().join(","), interval] as const,
};

export const useGoldForBusinessesQuery = () => useQuery({ queryKey: goldForBusinessesQueryKeys.overview, queryFn: goldForBusinessesService.fetchGoldForBusinesses });

export function useGoldForBusinessesQuote(profileIds: readonly string[], interval: GoldForBusinessesInterval, enabled: boolean) {
  return useQuery({
    queryKey: goldForBusinessesQueryKeys.quote(profileIds, interval),
    queryFn: () => goldForBusinessesService.quoteGoldForBusinesses({ profileIds, interval }),
    enabled: enabled && profileIds.length > 0,
    placeholderData: keepPreviousData,
    staleTime: 0,
    retry: false,
  });
}
