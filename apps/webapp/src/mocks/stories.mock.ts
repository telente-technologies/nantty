import { ApiError } from "@/errors/api.error";
import type { Story, StoryTrayItem } from "@/types";

import { getSignedInMockUser, isoDateHoursAgo } from "./fixtures.mock";
import { postImageUrlsForPhotoKey, productImageUrlsForProduct } from "./mockImages.mock";
import { currentMediaAsset } from "./media.mock";
import { createMockRoute, type MockRoute } from "./registry.mock";
import { findDirectoryUserById, summariseUser, userSummaryById } from "./userDirectory.mock";

const STORY_IMAGES_BY_USER_ID: Record<string, readonly string[]> = {
  u_1: productImageUrlsForProduct("f1").slice(0, 2),
  u_10: postImageUrlsForPhotoKey("jollofRice"),
  u_2: productImageUrlsForProduct("g6").slice(0, 2),
  u_15: [...postImageUrlsForPhotoKey("beachSunset"), ...postImageUrlsForPhotoKey("airportTravel")],
  u_13: productImageUrlsForProduct("b6"),
  u_9: postImageUrlsForPhotoKey("weddingAsoEbi").slice(0, 2),
};

const seenStoryIds = new Set<string>();
const publishedStoriesByUserId = new Map<string, Story[]>();

const tray = (): StoryTrayItem[] =>
  [...new Set([...publishedStoriesByUserId.keys(), ...Object.keys(STORY_IMAGES_BY_USER_ID)])].filter((userId) => findDirectoryUserById(userId)).map((userId) => ({
    user: summariseUser(findDirectoryUserById(userId)!),
    hasUnseen: (STORY_IMAGES_BY_USER_ID[userId] ?? []).some((_, index) => !seenStoryIds.has(`st_${userId}_${index}`)),
  }));

const buildStoriesForUser = (userId: string): Story[] => {
  const author = userId === getSignedInMockUser().id ? summariseUser(getSignedInMockUser()) : findDirectoryUserById(userId) ? userSummaryById(userId as "u_1") : null;
  if (!author) return [];
  const seeded: Story[] = (STORY_IMAGES_BY_USER_ID[userId] ?? []).map((url, index) => ({
    id: `st_${userId}_${index}`,
    author,
    media: { type: "image", url },
    createdAt: isoDateHoursAgo(2 + index * 3),
    seen: seenStoryIds.has(`st_${userId}_${index}`),
  }));
  return [...seeded, ...(publishedStoriesByUserId.get(userId) ?? [])];
};

export const storiesMocks: MockRoute[] = [
  createMockRoute("GET", "/api/v1/stories/tray", () => tray()),
  createMockRoute("GET", "/api/v1/users/:userId/stories", ({ params }) => buildStoriesForUser(params.userId!)),
  createMockRoute("POST", "/api/v1/stories/:storyId/seen", ({ params }) => void seenStoryIds.add(params.storyId!)),
  createMockRoute("POST", "/api/v1/stories/:storyId/replies", () => undefined),
  createMockRoute("POST", "/api/v1/stories", ({ body }) => {
    const { mediaId } = body as { mediaId?: string };
    const asset = mediaId ? currentMediaAsset(mediaId) : null;
    if (!asset) throw new ApiError(422, "Your story upload could not be found", "MEDIA_NOT_FOUND");
    if (asset.status === "failed" || asset.type === "audio") throw new ApiError(422, "This upload can't be used as a story", "UNSUPPORTED_STORY_MEDIA");
    const viewer = getSignedInMockUser();
    const story: Story = {
      id: `st_${Date.now()}`,
      author: summariseUser(viewer),
      media: { id: asset.id, type: asset.type === "video" ? "video" : "image", url: asset.variants[0]?.url ?? null, status: asset.status },
      createdAt: new Date().toISOString(),
      seen: true,
    };
    publishedStoriesByUserId.set(viewer.id, [...(publishedStoriesByUserId.get(viewer.id) ?? []), story]);
    return story;
  }),
];
