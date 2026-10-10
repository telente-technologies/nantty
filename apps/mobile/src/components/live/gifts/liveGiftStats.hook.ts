import { useMutation, useQuery, useQueryClient, type QueryKey } from "@tanstack/react-query";
import { useEffect, useRef } from "react";

import { giftsService, type LiveGiftGoalInput } from "@/services/money/gifts.service";

import { useLiveGiftSentEvents } from "./liveGiftEventStream.hook";

const REFRESH_THROTTLE_MS = 1_000;

export const liveGiftGoalQueryKey = (liveId: string) => ["live-gift-goal", liveId] as const;
export const liveGiftStreamStatsQueryKey = (liveId: string) => ["live-gift-stream-stats", liveId] as const;
export const liveGiftLeaderboardQueryKey = (liveId: string) => ["live-gift-leaderboard", liveId] as const;

function useRefreshQueryOnLiveGiftEvents(liveId: string, queryKey: QueryKey, enabled: boolean) {
  const queryClient = useQueryClient();
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useLiveGiftSentEvents(liveId, () => {
    if (!enabled || timer.current) return;
    timer.current = setTimeout(() => {
      timer.current = null;
      void queryClient.invalidateQueries({ queryKey });
    }, REFRESH_THROTTLE_MS);
  });
  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    [],
  );
}

export function useLiveGiftGoal(liveId: string) {
  useRefreshQueryOnLiveGiftEvents(liveId, liveGiftGoalQueryKey(liveId), true);
  const goals = useQuery({ queryKey: liveGiftGoalQueryKey(liveId), queryFn: () => giftsService.fetchLiveGiftGoals(liveId) });
  return { goal: goals.data?.data.find((goal) => goal.status !== "cancelled") ?? null, isLoading: goals.isPending };
}

export function useSaveLiveGiftGoal(liveId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ goalId, input }: { goalId: string | null; input: LiveGiftGoalInput }) =>
      goalId ? giftsService.updateLiveGiftGoal(liveId, goalId, input) : giftsService.createLiveGiftGoal(liveId, input),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: liveGiftGoalQueryKey(liveId) }),
  });
}

export function useLiveGiftStreamStats(liveId: string, enabled: boolean) {
  useRefreshQueryOnLiveGiftEvents(liveId, liveGiftStreamStatsQueryKey(liveId), enabled);
  return useQuery({ queryKey: liveGiftStreamStatsQueryKey(liveId), queryFn: () => giftsService.fetchLiveGiftStreamStats(liveId), enabled });
}

export function useLiveGiftLeaderboard(liveId: string, enabled: boolean) {
  useRefreshQueryOnLiveGiftEvents(liveId, liveGiftLeaderboardQueryKey(liveId), enabled);
  return useQuery({ queryKey: liveGiftLeaderboardQueryKey(liveId), queryFn: () => giftsService.fetchLiveGiftLeaderboard(liveId), enabled });
}
