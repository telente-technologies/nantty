import type { HostLiveStatus, StoryRingStatus } from "@/utils/profileAvatarPresence.util";

import { sendRequestToWebappServer } from "./clientApi.service";

export const profileAvatarPresenceService = {
  fetchStoryRingStatus: (userId: string) => sendRequestToWebappServer<StoryRingStatus>(`/api/v1/users/${encodeURIComponent(userId)}/story-status`),
  fetchHostLiveStatus: (userId: string) => sendRequestToWebappServer<HostLiveStatus>(`/api/v1/users/${encodeURIComponent(userId)}/live`),
};
