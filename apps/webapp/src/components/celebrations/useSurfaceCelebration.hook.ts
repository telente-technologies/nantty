"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";

import { useSession } from "@/components/providers/sessionProvider";
import { celebrationsService } from "@/services/celebrations.service";
import type { ActiveCelebration, CelebrationSurface, ViewerCelebrations } from "@/types/celebrations.type";
import { celebrationSeenKey, deviceTimezone, pickCelebration } from "@/utils/celebrations.util";

export const celebrationsQueryKey = ["celebrations", "me"] as const;

function readSeenLocally(key: string): boolean {
  try {
    return window.localStorage.getItem(key) !== null;
  } catch {
    return false;
  }
}

function writeSeenLocally(key: string): void {
  try {
    window.localStorage.setItem(key, "1");
  } catch {
    return;
  }
}

export function useViewerCelebrationsQuery(enabled: boolean) {
  const queryClient = useQueryClient();
  const syncedTimezone = useRef(false);
  const query = useQuery({ queryKey: celebrationsQueryKey, queryFn: celebrationsService.fetchMine, enabled, staleTime: 5 * 60_000, retry: false });
  useEffect(() => {
    const timezone = deviceTimezone();
    if (!query.data || query.data.timezoneConfigured || syncedTimezone.current || !timezone) return;
    syncedTimezone.current = true;
    celebrationsService.updateSettings({ timezone }).then((next) => queryClient.setQueryData(celebrationsQueryKey, next)).catch(() => undefined);
  }, [query.data, queryClient]);
  return query;
}

export function useSurfaceCelebration(surface: CelebrationSurface, enabled: boolean, extraStats?: ViewerCelebrations["anniversary"]["stats"]) {
  const { viewer } = useSession();
  const queryClient = useQueryClient();
  const query = useViewerCelebrationsQuery(enabled && viewer !== null);
  const [active, setActive] = useState<ActiveCelebration | null>(null);
  const [dismissed, setDismissed] = useState(false);
  const handled = useRef(false);

  useEffect(() => {
    const celebrations = query.data;
    if (handled.current || !viewer || !celebrations) return;
    const next = pickCelebration(celebrations, surface, viewer.name, extraStats);
    if (!next) return;
    handled.current = true;
    const key = celebrationSeenKey(viewer.id, next.kind, surface, celebrations.localDate);
    if (readSeenLocally(key)) return;
    writeSeenLocally(key);
    setActive(next);
    celebrationsService.markSeen(next.kind, surface).then(() => queryClient.invalidateQueries({ queryKey: celebrationsQueryKey })).catch(() => undefined);
  }, [query.data, viewer, surface, extraStats, queryClient]);

  return { celebration: dismissed ? null : active, dismiss: () => setDismissed(true) };
}
