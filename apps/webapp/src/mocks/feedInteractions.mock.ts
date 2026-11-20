import { ApiError } from "@/errors/api.error";

import { findMockClipsByIds } from "./clips.mock";
import { getSignedInMockUser } from "./fixtures.mock";
import { mockPostsState } from "./postCatalog.mock";
import { createMockRoute, type MockRoute } from "./registry.mock";

const INTERACTION_KINDS = new Set(["view", "dwell", "watch", "link_click", "profile_click", "follow"]);
const MAXIMUM_EVENTS_PER_BATCH = 50;
const MAXIMUM_MILLISECONDS = 3_600_000;
const REPEAT_VIEW_COOLDOWN_MS = 10 * 60_000;
const lastCountedViewAt = new Map<string, number>();

interface MockInteraction {
  readonly postId?: unknown;
  readonly kind?: unknown;
  readonly watchMs?: unknown;
  readonly dwellMs?: unknown;
  readonly durationMs?: unknown;
  readonly watchFraction?: unknown;
}

export const receivedMockFeedInteractions: MockInteraction[] = [];

const isWithin = (value: unknown, maximum: number) => value === undefined || (typeof value === "number" && value >= 0 && value <= maximum);

function assertValidInteraction(event: MockInteraction) {
  const valid = typeof event.postId === "string" && typeof event.kind === "string" && INTERACTION_KINDS.has(event.kind)
    && isWithin(event.watchMs, MAXIMUM_MILLISECONDS) && isWithin(event.dwellMs, MAXIMUM_MILLISECONDS) && isWithin(event.durationMs, MAXIMUM_MILLISECONDS) && isWithin(event.watchFraction, 1);
  if (!valid) throw new ApiError(400, "Invalid interaction", "VALIDATION_FAILED");
}

function countViewOutsideCooldown(postId: string) {
  const post = mockPostsState.get(postId);
  const now = Date.now();
  if (!post || now - (lastCountedViewAt.get(postId) ?? 0) < REPEAT_VIEW_COOLDOWN_MS) return;
  lastCountedViewAt.set(postId, now);
  mockPostsState.set(postId, { ...post, views: post.views + 1 });
}

export const feedInteractionsMocks: MockRoute[] = [
  createMockRoute("POST", "/api/v1/feeds/interactions/batch", ({ body }) => {
    const events = (body as { events?: unknown } | undefined)?.events;
    if (!Array.isArray(events) || events.length === 0 || events.length > MAXIMUM_EVENTS_PER_BATCH) throw new ApiError(400, "Send between 1 and 50 interactions", "VALIDATION_FAILED");
    (events as MockInteraction[]).forEach(assertValidInteraction);
    const viewerId = getSignedInMockUser().id;
    let accepted = 0;
    let skipped = 0;
    for (const event of events as MockInteraction[]) {
      const postId = event.postId as string;
      const post = mockPostsState.get(postId) ?? findMockClipsByIds([postId])[0];
      if (!post) {
        skipped += 1;
        continue;
      }
      accepted += 1;
      if (post.author.id === viewerId) continue;
      receivedMockFeedInteractions.push(event);
      if (event.kind === "view") countViewOutsideCooldown(postId);
    }
    return { accepted, skipped };
  }),
  createMockRoute("POST", "/api/v1/analytics/events", ({ body }) => {
    const events = (body as { events?: unknown } | undefined)?.events;
    if (!Array.isArray(events) || events.length === 0 || events.length > MAXIMUM_EVENTS_PER_BATCH) {
      throw new ApiError(400, "Provide between 1 and 50 analytics events.", "INVALID_BATCH_SIZE");
    }
    return { accepted: events.length, ignored: 0 };
  }),
];
