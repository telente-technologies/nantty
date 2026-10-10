import { useFocusEffect } from "@react-navigation/native";
import { useQuery } from "@tanstack/react-query";
import { useCallback, useEffect, useMemo, useRef } from "react";
import { AppState } from "react-native";

import { productsService } from "@/services/sellers/products.service";

import { orderMartHighlightsForSession } from "./martHighlightsOrder.util";

export const MART_HIGHLIGHTS_STALE_MS = 5 * 60_000;

export function useMartHighlights() {
  const query = useQuery({
    queryKey: ["mart", "highlights"],
    queryFn: () => productsService.fetchMartHighlights(null),
    staleTime: MART_HIGHLIGHTS_STALE_MS,
  });
  const latest = useRef(query);
  latest.current = query;

  const refreshIfStale = useCallback(() => {
    const { dataUpdatedAt, isFetching, refetch } = latest.current;
    if (!isFetching && Date.now() - dataUpdatedAt > MART_HIGHLIGHTS_STALE_MS) void refetch();
  }, []);

  useFocusEffect(refreshIfStale);

  useEffect(() => {
    const subscription = AppState.addEventListener("change", (state) => {
      if (state === "active") refreshIfStale();
    });
    return () => subscription.remove();
  }, [refreshIfStale]);

  const highlights = useMemo(() => orderMartHighlightsForSession(query.data?.data ?? []), [query.data]);

  return { highlights, isLoading: query.isLoading, isRefetching: query.isRefetching, refetch: query.refetch };
}
