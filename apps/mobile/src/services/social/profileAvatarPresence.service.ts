import type { HostLiveStatus, StoryRingStatus } from "@/utils/profileAvatarPresence.util";

import { api } from "../core/apiClient.service";

export const profileAvatarPresenceService = {
  fetchStoryRingStatus: (userId: string) => api.get<StoryRingStatus>(`/api/v1/users/${encodeURIComponent(userId)}/story-status`),
  fetchHostLiveStatus: (userId: string) => api.get<HostLiveStatus>(`/api/v1/users/${encodeURIComponent(userId)}/live`),
};
