import AsyncStorage from "@react-native-async-storage/async-storage";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";

import { celebrationsService } from "@/services/social/celebrations.service";
import { useAuthStore } from "@/store/auth.store";
import type { ActiveCelebration, CelebrationSurface, ViewerCelebrations } from "@/types/celebrations.type";
import { celebrationSeenKey, deviceTimezone, pickCelebration } from "@/utils/celebrations.util";

export const celebrationsQueryKey = ["celebrations", "me"] as const;

const readSeenLocally = (key: string) => AsyncStorage.getItem(key).then((value) => value !== null, () => false);
const writeSeenLocally = (key: string) => AsyncStorage.setItem(key, "1").catch(() => undefined);

export function useViewerCelebrationsQuery(enabled: boolean) {
  const queryClient = useQueryClient();
  const syncedTimezone = useRef(false);
  const query = useQuery({ queryKey: celebrationsQueryKey, queryFn: celebrationsService.fetchMine, enabled, staleTime: 5 * 60_000 });
  useEffect(() => {
    const timezone = deviceTimezone();
    if (!query.data || query.data.timezoneConfigured || syncedTimezone.current || !timezone) return;
    syncedTimezone.current = true;
    celebrationsService.updateSettings({ timezone }).then((next) => queryClient.setQueryData(celebrationsQueryKey, next)).catch(() => undefined);
  }, [query.data, queryClient]);
  return query;
}

export function useSurfaceCelebration(surface: CelebrationSurface, enabled: boolean, extraStats?: ViewerCelebrations["anniversary"]["stats"]) {
  const user = useAuthStore((state) => state.user);
  const queryClient = useQueryClient();
  const query = useViewerCelebrationsQuery(enabled && user !== null);
  const [active, setActive] = useState<ActiveCelebration | null>(null);
  const [dismissed, setDismissed] = useState(false);
  const handled = useRef(false);

  useEffect(() => {
    const celebrations = query.data;
    if (handled.current || !user || !celebrations) return;
    const next = pickCelebration(celebrations, surface, user.name, extraStats);
    if (!next) return;
    handled.current = true;
    const key = celebrationSeenKey(user.id, next.kind, surface, celebrations.localDate);
    readSeenLocally(key).then((seen) => {
      if (seen) return;
      setActive(next);
      writeSeenLocally(key);
      celebrationsService.markSeen(next.kind, surface).then(() => queryClient.invalidateQueries({ queryKey: celebrationsQueryKey })).catch(() => undefined);
    });
  }, [query.data, user, surface, extraStats, queryClient]);

  return { celebration: dismissed ? null : active, dismiss: () => setDismissed(true) };
}
