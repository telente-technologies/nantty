import type { ID, Story, StoryTrayItem, UserSummary } from "@/types";

import { sendListRequestToWebappServer, sendRequestToWebappServer } from "./clientApi.service";

export interface StoryViewersPage {
  readonly viewers: readonly UserSummary[];
  readonly total: number;
  readonly nextCursor: string | null;
}

export const storiesService = {
  fetchStoryTray: () => sendListRequestToWebappServer<StoryTrayItem>("/api/v1/stories/tray"),
  fetchStoriesForUser: (userId: ID) => sendListRequestToWebappServer<Story>(`/api/v1/users/${encodeURIComponent(userId)}/stories`),
  markStoryAsSeen: (storyId: ID) => sendRequestToWebappServer<void>(`/api/v1/stories/${encodeURIComponent(storyId)}/seen`, { method: "POST" }),
  fetchStoryViewers: (storyId: ID, cursor?: string | null) =>
    sendRequestToWebappServer<StoryViewersPage>(`/api/v1/stories/${encodeURIComponent(storyId)}/viewers`, { query: { cursor: cursor ?? undefined } }),
};
