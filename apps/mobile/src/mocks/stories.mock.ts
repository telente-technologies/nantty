import type { Story, StoryTrayItem } from "@/types";
import { ApiError } from "@/errors/api.error";

import { getSignedInMockUser, isoDateHoursAgo } from "./fixtures.mock";
import { findMockPostMediaById } from "./media.mock";
import { postImageUrlsForPhotoKey, productImageUrlsForProduct } from "./mockImages.mock";
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

const tray = (): StoryTrayItem[] =>
  Object.keys(STORY_IMAGES_BY_USER_ID).map((userId) => ({
    user: summariseUser(findDirectoryUserById(userId)!),
    hasUnseen: (STORY_IMAGES_BY_USER_ID[userId] ?? []).some((_, index) => !seenStoryIds.has(`st_${userId}_${index}`)),
  }));

const buildStoriesForUser = (userId: string): Story[] => {
  const author = userId === getSignedInMockUser().id ? summariseUser(getSignedInMockUser()) : findDirectoryUserById(userId) ? userSummaryById(userId as "u_1") : null;
  if (!author) return [];
  return (STORY_IMAGES_BY_USER_ID[userId] ?? []).map((url, index) => ({
    id: `st_${userId}_${index}`,
    author,
    media: { type: "image", url },
    createdAt: isoDateHoursAgo(2 + index * 3),
    seen: seenStoryIds.has(`st_${userId}_${index}`),
  }));
};

export const storiesMocks: MockRoute[] = [
  createMockRoute("GET", "/api/v1/stories/tray", () => tray()),
  createMockRoute("GET", "/api/v1/users/:userId/stories", ({ params }) => buildStoriesForUser(params.userId!)),
  createMockRoute("POST", "/api/v1/stories/:storyId/seen", ({ params }) => void seenStoryIds.add(params.storyId!)),
  createMockRoute("POST", "/api/v1/stories/:storyId/replies", ({ body }) => {
    const input = (body ?? {}) as { text?: string; encryption?: { ciphertext?: string } };
    if (input.text !== undefined || !input.encryption?.ciphertext) throw new ApiError(400, "Story replies are end-to-end encrypted.", "VALIDATION_FAILED");
  }),
  createMockRoute("POST", "/api/v1/stories", ({ body }) => ({
    id: `st_${Date.now()}`,
    author: summariseUser(getSignedInMockUser()),
    media: findMockPostMediaById((body as { mediaId: string }).mediaId) ?? (body as { media: Story["media"] }).media,
    createdAt: new Date().toISOString(),
    seen: true,
  })),
];
