export interface StoryRingStatus {
  readonly hasActiveStory: boolean;
  readonly hasUnseenStory: boolean;
}

export const storyRingHiddenFromViewer: StoryRingStatus = { hasActiveStory: false, hasUnseenStory: false };

export function summariseStoryRingForViewer(activeStoryIds: readonly string[], seenStoryIds: ReadonlySet<string>, viewerIsOwner: boolean): StoryRingStatus {
  if (activeStoryIds.length === 0) return storyRingHiddenFromViewer;
  return { hasActiveStory: true, hasUnseenStory: !viewerIsOwner && activeStoryIds.some((storyId) => !seenStoryIds.has(storyId)) };
}
