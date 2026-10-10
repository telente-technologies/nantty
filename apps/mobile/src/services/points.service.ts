import type { LivePointsAction, LivePointsAward, LiveViewerPoints } from "@/types/socialGraph.type";

import { api } from "./apiClient.service";

export const pointsService = {
  fetchMyLivePoints: (liveId: string) => api.get<LiveViewerPoints>(`/api/v1/lives/${encodeURIComponent(liveId)}/points/me`),
  awardLiveEngagementPoints: (liveId: string, action: LivePointsAction) =>
    api.post<LivePointsAward>(`/api/v1/lives/${encodeURIComponent(liveId)}/engagement`, { action }),
};
