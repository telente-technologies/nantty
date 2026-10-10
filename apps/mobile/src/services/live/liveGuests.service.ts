import type { UserSummary } from "@/types";
import type { CreateLiveBattleInput, LiveStage, MuteStreamerInput, SendLiveBattleGiftInput } from "@/types/liveStage.type";

import { api, generateIdempotencyKey } from "../core/apiClient.service";

const livePath = (liveId: string) => `/api/v1/lives/${liveId}`;
const battlePath = (battleId: string) => `/api/v1/battles/${battleId}`;

export const liveGuestsService = {
  fetchLiveStage: (liveId: string) => api.get<LiveStage>(`${livePath(liveId)}/stage`),
  searchLiveViewersToInvite: (liveId: string, query: string) => api.getList<UserSummary>(`${livePath(liveId)}/viewers`, { q: query }),
  inviteViewerToStage: (liveId: string, userId: string) => api.post<LiveStage>(`${livePath(liveId)}/guests/invitations`, { userId }),
  respondToStageInvitation: (liveId: string, slotId: string, response: "accept" | "decline") =>
    api.post<LiveStage>(`${livePath(liveId)}/guests/invitations/${slotId}/${response}`),
  requestToJoinStage: (liveId: string) => api.post<LiveStage>(`${livePath(liveId)}/guests/requests`),
  decideStageJoinRequest: (liveId: string, requestId: string, decision: "approve" | "decline") =>
    api.post<LiveStage>(`${livePath(liveId)}/guests/requests/${requestId}/${decision}`),
  removeGuestFromStage: (liveId: string, userId: string) => api.post<LiveStage>(`${livePath(liveId)}/guests/${userId}/remove`),
  muteStreamer: (liveId: string, userId: string, input: MuteStreamerInput) => api.post<LiveStage>(`${livePath(liveId)}/guests/${userId}/mute`, input),
  leaveStage: (liveId: string) => api.post<LiveStage>(`${livePath(liveId)}/guests/me/leave`),
  createLiveBattle: (liveId: string, input: CreateLiveBattleInput) =>
    api.post<LiveStage>(`${livePath(liveId)}/battles`, input, { idempotencyKey: generateIdempotencyKey() }),
  respondToWinnerTakesAllProposal: (battleId: string, response: "accept" | "decline") => api.post<LiveStage>(`${battlePath(battleId)}/${response}`),
  cancelPendingBattle: (battleId: string) => api.post<LiveStage>(`${battlePath(battleId)}/cancel`),
  startPendingBattleWithoutWinnerTakesAll: (battleId: string) => api.post<LiveStage>(`${battlePath(battleId)}/start-without-winner-takes-all`),
  endLiveBattleEarly: (battleId: string) => api.post<LiveStage>(`${battlePath(battleId)}/end`),
  creditLiveBattleGift: (battleId: string, input: SendLiveBattleGiftInput) => api.post<LiveStage>(`${battlePath(battleId)}/gifts`, input),
};
