import { useCallback, useRef, useState } from "react";
import { RefreshControl } from "react-native";

import { useTheme } from "@/theme";

type Refetcher = () => Promise<unknown> | unknown;

export function usePullToRefresh(...refetchers: readonly Refetcher[]) {
  const { colors } = useTheme();
  const [refreshing, setRefreshing] = useState(false);
  const latest = useRef(refetchers);
  latest.current = refetchers;
  const onRefresh = useCallback(() => {
    setRefreshing(true);
    Promise.allSettled(latest.current.map((refetch) => refetch())).finally(() => setRefreshing(false));
  }, []);
  return <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} colors={[colors.primary]} progressBackgroundColor={colors.surface} />;
}
