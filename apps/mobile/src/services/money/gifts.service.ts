import type { Page, LiveGift, LiveGiftGoal, LiveGiftLeaderboard, LiveGiftStreamStats, SendLiveGiftInput, SentLiveGiftReceipt } from "@/types";

import { api, generateIdempotencyKey } from "../core/apiClient.service";

export interface LiveGiftGoalInput {
  readonly title: string;
  readonly targetCoins: number;
  readonly giftId?: string | null;
}

export const giftsService = {
  fetchLiveGiftCatalog: () => api.get<Page<LiveGift>>("/api/v1/gifts"),
  sendGiftToLive: (input: SendLiveGiftInput, idempotencyKey = generateIdempotencyKey()) =>
    api.post<SentLiveGiftReceipt>("/api/v1/live/gifts", input, { idempotencyKey }),
  fetchLiveGiftLeaderboard: (liveId: string, scope: "session" | "recipient" = "session", receiverUserId?: string) =>
    api.get<LiveGiftLeaderboard>(`/api/v1/lives/${liveId}/leaderboard`, { scope, receiverUserId, limit: 20 }),
  fetchLiveGiftStreamStats: (liveId: string) => api.get<LiveGiftStreamStats>(`/api/v1/creators/me/analytics/gifts/streams/${liveId}`),
  fetchLiveGiftGoals: (liveId: string) => api.get<Page<LiveGiftGoal>>(`/api/v1/lives/${liveId}/gift-goals`),
  createLiveGiftGoal: (liveId: string, goal: LiveGiftGoalInput) => api.post<LiveGiftGoal>(`/api/v1/lives/${liveId}/gift-goals`, goal),
  updateLiveGiftGoal: (liveId: string, goalId: string, changes: Partial<LiveGiftGoalInput>) =>
    api.patch<LiveGiftGoal>(`/api/v1/lives/${liveId}/gift-goals/${goalId}`, changes),
};
