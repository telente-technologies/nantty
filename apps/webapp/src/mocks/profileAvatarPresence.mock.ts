import { getSignedInMockUser } from "./fixtures.mock";
import { findMockLiveIdForHost } from "./live.mock";
import { createMockRoute, type MockRoute } from "./registry.mock";
import { blockedUserIds } from "./socialGraph.mock";
import { storyRingStatusForMockUser } from "./stories.mock";

const isHiddenFromSignedInViewer = (userId: string) => userId !== getSignedInMockUser().id && blockedUserIds.has(userId);

export const profileAvatarPresenceMocks: MockRoute[] = [
  createMockRoute("GET", "/api/v1/users/:userId/story-status", ({ params }) =>
    isHiddenFromSignedInViewer(params.userId!) ? { hasActiveStory: false, hasUnseenStory: false } : storyRingStatusForMockUser(params.userId!)),
  createMockRoute("GET", "/api/v1/users/:userId/live", ({ params }) => {
    const liveStreamId = isHiddenFromSignedInViewer(params.userId!) ? null : findMockLiveIdForHost(params.userId!);
    return { liveStreamId, startedAt: liveStreamId ? new Date(Date.now() - 18 * 60 * 1000).toISOString() : null };
  }),
];
