import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";

import { liveGiftLeaderboardQueryKey } from "@/components/live/gifts/liveGiftStats.hook";
import { pointsService } from "@/services/social/points.service";
import type { LivePointsAction, LiveViewerPoints } from "@/types/socialGraph.type";

const WATCH_TIME_POINTS_INTERVAL_MS = 60_000;

export const liveViewerPointsQueryKey = (liveId: string) => ["live-viewer-points", liveId] as const;

export function useLiveViewerPoints(liveId: string, enabled: boolean) {
  return useQuery({ queryKey: liveViewerPointsQueryKey(liveId), queryFn: () => pointsService.fetchMyLivePoints(liveId), enabled });
}

export function useLiveEngagementPoints(liveId: string, isEarningEnabled: boolean) {
  const queryClient = useQueryClient();
  const award = useMutation({
    mutationFn: (action: LivePointsAction) => pointsService.awardLiveEngagementPoints(liveId, action),
    onSuccess: ({ awarded, totalPoints, likePointsThisMinute }) => {
      queryClient.setQueryData<LiveViewerPoints>(liveViewerPointsQueryKey(liveId), { totalPoints, likePointsThisMinute });
      if (awarded > 0) void queryClient.invalidateQueries({ queryKey: liveGiftLeaderboardQueryKey(liveId) });
    },
  });
  const awardPoints = award.mutate;

  useEffect(() => {
    if (!isEarningEnabled) return;
    const timer = setInterval(() => awardPoints("watch"), WATCH_TIME_POINTS_INTERVAL_MS);
    return () => clearInterval(timer);
  }, [isEarningEnabled, awardPoints]);

  return {
    awardLikePoints: () => isEarningEnabled && awardPoints("like"),
    awardSharePoints: () => isEarningEnabled && awardPoints("share"),
    awardFollowPoints: () => isEarningEnabled && awardPoints("follow"),
  };
}
