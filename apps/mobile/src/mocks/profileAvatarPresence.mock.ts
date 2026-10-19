import { findActiveLiveForHost } from "./activeLives.mock";
import { getSignedInMockUser } from "./fixtures.mock";
import { createMockRoute, type MockRoute } from "./registry.mock";
import { blockedUserIds, canSignedInUserSeeProfileContent } from "./socialGraph.mock";
import { storyRingStatusForMockUser } from "./stories.mock";

const isProfileHiddenFromSignedInViewer = (userId: string) =>
  userId !== getSignedInMockUser().id && (blockedUserIds.has(userId) || !canSignedInUserSeeProfileContent(userId));

export const profileAvatarPresenceMocks: MockRoute[] = [
  createMockRoute("GET", "/api/v1/users/:userId/story-status", ({ params }) =>
    isProfileHiddenFromSignedInViewer(params.userId!) ? { hasActiveStory: false, hasUnseenStory: false } : storyRingStatusForMockUser(params.userId!)),
  createMockRoute("GET", "/api/v1/users/:userId/live", ({ params }) => {
    const live = isProfileHiddenFromSignedInViewer(params.userId!) ? null : findActiveLiveForHost(params.userId!);
    return { liveStreamId: live?.liveId ?? null, startedAt: live?.startedAt ?? null };
  }),
];
