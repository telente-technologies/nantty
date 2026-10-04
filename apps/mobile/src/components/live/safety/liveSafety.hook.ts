import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";

import { shouldUseMockForPath } from "@/config/api.config";
import { liveSafetyService } from "@/services/liveSafety.service";
import { realtimeService } from "@/services/realtime.service";
import type { LiveSafetyHostNoticeRealtimeEvent, LiveSafetyState } from "@/types";

const SAFETY_POLL_INTERVAL_MS = 10_000;

export interface LiveSafetyController {
  readonly safety: LiveSafetyState | null;
  readonly isPaused: boolean;
  readonly latestHostNotice: LiveSafetyHostNoticeRealtimeEvent | null;
  readonly refresh: () => void;
}

export function useLiveSafety(liveId: string, sessionSafety: LiveSafetyState | null | undefined, isHost: boolean, isActive: boolean): LiveSafetyController {
  const queryClient = useQueryClient();
  const [latestHostNotice, setLatestHostNotice] = useState<LiveSafetyHostNoticeRealtimeEvent | null>(null);
  const safetyQuery = useQuery({
    queryKey: ["live-safety", liveId],
    queryFn: () => liveSafetyService.fetchLiveSafetyState(liveId),
    enabled: isActive && isHost,
    refetchInterval: SAFETY_POLL_INTERVAL_MS,
  });

  useEffect(() => {
    if (!isActive || shouldUseMockForPath("/ws")) return undefined;
    return realtimeService.subscribeToRealtimeEvents((event) => {
      if (event.type === "live.safety.paused" || event.type === "live.safety.resumed") {
        if (event.liveId !== liveId) return;
        queryClient.invalidateQueries({ queryKey: ["live", liveId] });
        queryClient.invalidateQueries({ queryKey: ["live-safety", liveId] });
      }
      if (event.type === "live.safety.hostNotice" && event.liveId === liveId && isHost) {
        setLatestHostNotice(event);
        queryClient.invalidateQueries({ queryKey: ["live-safety", liveId] });
      }
    });
  }, [isActive, isHost, liveId, queryClient]);

  const safety = isHost && safetyQuery.data ? safetyQuery.data.safety : sessionSafety ?? null;
  return {
    safety,
    isPaused: safety?.state === "paused",
    latestHostNotice,
    refresh: () => {
      queryClient.invalidateQueries({ queryKey: ["live", liveId] });
      queryClient.invalidateQueries({ queryKey: ["live-safety", liveId] });
    },
  };
}
