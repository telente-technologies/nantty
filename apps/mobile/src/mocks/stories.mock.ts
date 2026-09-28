import type { Story } from "@/types";

import { buildMockUserSummary, isoDateHoursAgo, me } from "./fixtures.mock";
import { createMockRoute, type MockRoute } from "./registry.mock";

const tray = [
  { user: buildMockUserSummary(31, "Freda"), hasUnseen: true },
  { user: buildMockUserSummary(32, "Carlos"), hasUnseen: true },
];

const buildStoriesForUser = (userId: string): Story[] =>
  [1, 2].map((n) => ({
    id: `st_${userId}_${n}`,
    author: userId === me.id ? me : { ...buildMockUserSummary(31), id: userId },
    media: { type: "image", url: null },
    createdAt: isoDateHoursAgo(48),
    seen: false,
  }));

export const storiesMocks: MockRoute[] = [
  createMockRoute("GET", "/api/v1/stories/tray", () => tray),
  createMockRoute("GET", "/api/v1/users/:userId/stories", ({ params }) => buildStoriesForUser(params.userId!)),
  createMockRoute("POST", "/api/v1/stories/:storyId/seen", () => undefined),
  createMockRoute("POST", "/api/v1/stories/:storyId/replies", () => undefined),
  createMockRoute("POST", "/api/v1/stories", ({ body }) => ({
    id: `st_${Date.now()}`,
    author: me,
    media: (body as { media: Story["media"] }).media,
    createdAt: new Date().toISOString(),
    seen: true,
  })),
];
