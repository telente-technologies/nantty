import { describe, expect, it } from "vitest";

import { createListWidgetStoriesHandler } from "../../src/modules/widgets/queries/listWidgetStories/listWidgetStories.handler.js";
import { WidgetResponseCache } from "../../src/modules/widgets/services/widgetResponseCache.service.js";
import type { HandlerContext } from "../../src/types/handlerContext.type.js";

interface StoryFixture {
  readonly id: string;
  readonly authorId: string;
  readonly createdAt: Date;
  readonly expiresAt: Date;
  readonly visibility?: "public" | "subscribers";
  readonly audience?: "everyone" | "followers";
  readonly moderationVisibility?: string;
  readonly sensitiveLabels?: string[];
}

const now = new Date("2026-10-10T12:00:00Z");
const viewer = "viewer";
const hoursAgo = (hours: number) => new Date(now.getTime() - hours * 3_600_000);
const inHours = (hours: number) => new Date(now.getTime() + hours * 3_600_000);

function buildContext(stories: readonly StoryFixture[], options: { follows: string[]; blocks?: [string, string][]; privateIds?: string[]; seen?: string[] }): HandlerContext {
  const inList = (value: string, filter: { in?: string[] } | string | undefined) => filter === undefined || (typeof filter === "string" ? filter === value : (filter.in ?? []).includes(value));
  const client = {
    follow: {
      findMany: async ({ where }: { where: { followerId: string; followeeId?: { in: string[] } } }) =>
        options.follows.filter((id) => where.followerId === viewer && inList(id, where.followeeId)).map((followeeId) => ({ followeeId })),
    },
    block: {
      findMany: async ({ where }: { where: { blockerId?: string | { in: string[] }; blockedId?: string | { in: string[] } } }) =>
        (options.blocks ?? []).filter(([blocker, blocked]) => inList(blocker, where.blockerId) && inList(blocked, where.blockedId)).map(([blockerId, blockedId]) => ({ blockerId, blockedId })),
    },
    post: {
      findMany: async ({ where }: { where: { authorId: { in: string[] }; kind: string; visibility: string; audience: { in: string[] }; expiresAt: { gt: Date }; moderationVisibility: { in: string[] } } }) =>
        stories.filter((story) => where.authorId.in.includes(story.authorId) && (story.visibility ?? "public") === where.visibility && where.audience.in.includes(story.audience ?? "everyone")
          && story.expiresAt > where.expiresAt.gt && where.moderationVisibility.in.includes(story.moderationVisibility ?? "visible"))
          .sort((left, right) => right.id.localeCompare(left.id))
          .map((story) => ({ id: story.id, authorId: story.authorId, createdAt: story.createdAt, sensitiveLabels: story.sensitiveLabels ?? [], media: [{ type: "image", url: `https://cdn.test/${story.id}.webp`, posterUrl: null }] })),
    },
    storyView: { findMany: async () => (options.seen ?? []).map((storyId) => ({ storyId })) },
  };
  return {
    database: { client },
    clock: { now: () => now },
    directory: {
      findPrivateAccountIds: async () => new Set(options.privateIds ?? []),
      findUserSummaries: async (ids: readonly string[]) => new Map(ids.map((id) => [id, { id, name: id.toUpperCase(), username: id, avatarUrl: `https://cdn.test/${id}.jpg`, verified: false, isCreator: false }])),
    },
  } as unknown as HandlerContext;
}

describe("stories widget", () => {
  it("lists followed people with unseen stories first, newest first, respecting expiry, blocks and subscriber-only stories", async () => {
    const stories: StoryFixture[] = [
      { id: "s01", authorId: "ada", createdAt: hoursAgo(5), expiresAt: inHours(19) },
      { id: "s02", authorId: "bola", createdAt: hoursAgo(1), expiresAt: inHours(23) },
      { id: "s03", authorId: "chidi", createdAt: hoursAgo(2), expiresAt: inHours(22) },
      { id: "s04", authorId: "dayo", createdAt: hoursAgo(30), expiresAt: hoursAgo(6) },
      { id: "s05", authorId: "efe", createdAt: hoursAgo(1), expiresAt: inHours(23), visibility: "subscribers" },
      { id: "s06", authorId: "femi", createdAt: hoursAgo(1), expiresAt: inHours(23) },
      { id: "s07", authorId: "stranger", createdAt: hoursAgo(1), expiresAt: inHours(23) },
      { id: "s08", authorId: "gbenga", createdAt: hoursAgo(1), expiresAt: inHours(23), moderationVisibility: "removed" },
      { id: "s09", authorId: "chidi", createdAt: hoursAgo(1), expiresAt: inHours(23), sensitiveLabels: ["nudity"] },
    ];
    const context = buildContext(stories, { follows: ["ada", "bola", "chidi", "dayo", "efe", "femi", "gbenga"], blocks: [["femi", viewer]], seen: ["s02"] });
    const payload = await createListWidgetStoriesHandler(context)({ viewerId: viewer, limit: 8 });
    expect(payload.people.map((person) => person.userId)).toEqual(["chidi", "ada", "bola"]);
    const chidi = payload.people[0];
    expect(chidi?.hasUnseen).toBe(true);
    expect(chidi?.storyCount).toBe(2);
    expect(chidi?.thumbnailUrl).toBeNull();
    expect(chidi?.deepLink).toBe("nantty://stories/chidi");
    expect(payload.people[2]?.hasUnseen).toBe(false);
  });

  it("hides a private account the viewer no longer follows and caps the list", async () => {
    const stories: StoryFixture[] = Array.from({ length: 10 }, (_, index) => ({ id: `t${String(index).padStart(2, "0")}`, authorId: `p${index}`, createdAt: hoursAgo(index + 1), expiresAt: inHours(2) }));
    const follows = stories.map((story) => story.authorId);
    const payload = await createListWidgetStoriesHandler(buildContext(stories, { follows, privateIds: ["p0"] }))({ viewerId: viewer, limit: 4 });
    expect(payload.people).toHaveLength(4);
    expect(payload.people[0]?.userId).toBe("p0");
    const privateNotFollowed = await createListWidgetStoriesHandler(buildContext(stories, { follows: follows.slice(1), privateIds: ["p0"] }))({ viewerId: viewer, limit: 8 });
    expect(privateNotFollowed.people.some((person) => person.userId === "p0")).toBe(false);
  });

  it("returns an empty payload when the viewer follows nobody", async () => {
    const payload = await createListWidgetStoriesHandler(buildContext([], { follows: [] }))({ viewerId: viewer, limit: 8 });
    expect(payload.people).toEqual([]);
  });

  it("caches per viewer for a short time", async () => {
    let moment = 0;
    let loads = 0;
    const cache = new WidgetResponseCache<number>(1_000, 2, () => moment);
    const load = async () => ++loads;
    expect(await cache.getOrLoad("a", load)).toBe(1);
    expect(await cache.getOrLoad("a", load)).toBe(1);
    moment = 2_000;
    expect(await cache.getOrLoad("a", load)).toBe(2);
    await cache.getOrLoad("b", load);
    await cache.getOrLoad("c", load);
    expect(cache.size).toBeLessThanOrEqual(2);
  });
});
