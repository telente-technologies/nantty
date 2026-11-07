import { useIsFocused } from "@react-navigation/native";
import { useQuery } from "@tanstack/react-query";

import { FeedProductAdCard } from "@/components/ads/feedProductAdCard";
import { productAdsService, usableSearchProductAd } from "@/services/ads/productAds.service";
import { useAuthStore } from "@/store/auth.store";
import type { SearchScopeKey } from "@/types/search.type";

export function SearchProductAd({ query, scope }: { readonly query: string; readonly scope: SearchScopeKey }) {
  const focused = useIsFocused();
  const viewerId = useAuthStore((state) => state.status === "signedIn" ? state.user?.id ?? null : null);
  const decision = useQuery({
    queryKey: ["ads", "search-product-slot", viewerId, scope, query],
    queryFn: productAdsService.decideSearchProductAd,
    enabled: focused && Boolean(viewerId) && query.trim().length > 0,
    staleTime: Infinity,
    retry: false,
  });
  const ad = usableSearchProductAd(decision.data?.ad, decision.data?.receivedAt ?? 0) ? decision.data.ad : null;
  return ad ? <FeedProductAdCard ad={ad} placement="search" /> : null;
}
