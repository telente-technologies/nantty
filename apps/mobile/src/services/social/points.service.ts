import type { Page } from "@/types";
import type { LivePointsAction, LivePointsAward, LiveViewerPoints, RankingEntry, RankingQuery } from "@/types/socialGraph.type";

import { api } from "../core/apiClient.service";

export const pointsService = {
  fetchRankings: (query: RankingQuery, cursor?: string) => api.get<Page<RankingEntry>>("/api/v1/rankings", { ...query, cursor }),
  fetchMyLivePoints: (liveId: string) => api.get<LiveViewerPoints>(`/api/v1/lives/${encodeURIComponent(liveId)}/points/me`),
  awardLiveEngagementPoints: (liveId: string, action: LivePointsAction) =>
    api.post<LivePointsAward>(`/api/v1/lives/${encodeURIComponent(liveId)}/engagement`, { action }),
};
