import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { ApiError } from "@/services/core/apiClient.service";
import { liveGuestsService } from "@/services/live/liveGuests.service";
import { useAuthStore } from "@/store/auth.store";
import type { CreateLiveBattleInput, LiveStage, LiveStageInviteRole } from "@/types/liveStage.type";
import { requireAuthThen } from "@/utils/requireAuth.util";

const STAGE_POLL_INTERVAL_MS = 1_000;

export const liveStageQueryKey = (liveId: string) => ["live-stage", liveId] as const;

const describeStageActionError = (error: unknown) =>
  error instanceof ApiError ? error.message : "That didn't work. Check your connection and try again.";

export function useLiveStageWithActions(liveId: string, isWatching: boolean) {
  const queryClient = useQueryClient();
  const signedInUserId = useAuthStore((state) => state.user?.id ?? null);
  const stageQuery = useQuery({
    queryKey: liveStageQueryKey(liveId),
    queryFn: () => liveGuestsService.fetchLiveStage(liveId),
    enabled: isWatching,
    refetchInterval: isWatching ? STAGE_POLL_INTERVAL_MS : false,
  });

  const stageAction = useMutation({
    mutationFn: (perform: () => Promise<LiveStage>) => perform(),
    onSuccess: (stage) => queryClient.setQueryData(liveStageQueryKey(liveId), stage),
  });
  const run = (perform: () => Promise<LiveStage>) => stageAction.mutate(perform);

  const stage = stageQuery.data ?? null;
  const serverClockOffsetMs = stage ? Date.parse(stage.serverNow) - stageQuery.dataUpdatedAt : 0;

  return {
    stage,
    signedInUserId,
    serverClockOffsetMs,
    isMultiGuestLayout: (stage?.streamers.length ?? 0) > 1,
    isActionPending: stageAction.isPending,
    actionErrorMessage: stageAction.isError ? describeStageActionError(stageAction.error) : null,
    clearActionError: () => stageAction.reset(),
    inviteViewerToStage: (userId: string, role: LiveStageInviteRole = "speaker", title?: string) => run(() => liveGuestsService.inviteViewerToStage(liveId, userId, role, title)),
    acceptStageInvitation: (slotId: string) => run(() => liveGuestsService.respondToStageInvitation(liveId, slotId, "accept")),
    declineStageInvitation: (slotId: string) => run(() => liveGuestsService.respondToStageInvitation(liveId, slotId, "decline")),
    requestToJoinStage: () => requireAuthThen(() => run(() => liveGuestsService.requestToJoinStage(liveId)), undefined, "join the live as a guest"),
    approveJoinRequest: (requestId: string) => run(() => liveGuestsService.decideStageJoinRequest(liveId, requestId, "approve")),
    declineJoinRequest: (requestId: string) => run(() => liveGuestsService.decideStageJoinRequest(liveId, requestId, "decline")),
    removeGuestFromStage: (userId: string) => run(() => liveGuestsService.removeGuestFromStage(liveId, userId)),
    setStreamerAudioMuted: (userId: string, audio: boolean) => run(() => liveGuestsService.muteStreamer(liveId, userId, { audio })),
    setStreamerVideoMuted: (userId: string, video: boolean) => run(() => liveGuestsService.muteStreamer(liveId, userId, { video })),
    leaveStage: () => run(() => liveGuestsService.leaveStage(liveId)),
    createLiveBattle: (input: CreateLiveBattleInput) => run(() => liveGuestsService.createLiveBattle(liveId, input)),
    acceptWinnerTakesAllProposal: (battleId: string) => run(() => liveGuestsService.respondToWinnerTakesAllProposal(battleId, "accept")),
    declineWinnerTakesAllProposal: (battleId: string) => run(() => liveGuestsService.respondToWinnerTakesAllProposal(battleId, "decline")),
    cancelPendingBattle: (battleId: string) => run(() => liveGuestsService.cancelPendingBattle(battleId)),
    startPendingBattleWithoutWinnerTakesAll: (battleId: string) => run(() => liveGuestsService.startPendingBattleWithoutWinnerTakesAll(battleId)),
    endLiveBattleEarly: (battleId: string) => run(() => liveGuestsService.endLiveBattleEarly(battleId)),
    replaceStageSnapshot: (nextStage: LiveStage) => queryClient.setQueryData(liveStageQueryKey(liveId), nextStage),
  };
}

export type LiveStageController = ReturnType<typeof useLiveStageWithActions>;
