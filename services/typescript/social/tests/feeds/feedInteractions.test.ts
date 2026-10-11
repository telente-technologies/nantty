import { describe, expect, it } from "vitest";

import { createRecordFeedInteractionHandler } from "../../src/modules/feeds/commands/recordFeedInteraction/recordFeedInteraction.handler.js";
import { createRecordFeedInteractionBatchHandler } from "../../src/modules/feeds/commands/recordFeedInteractionBatch/recordFeedInteractionBatch.handler.js";
import { feedInteractionBatchBodySchema } from "../../src/modules/feeds/validators/feeds.validator.js";
import { buildVideoAnalytics } from "../../src/modules/posts/queries/getPostAnalytics/getPostAnalytics.handler.js";
import { createRecordPostImpressionHandler } from "../../src/modules/posts/commands/recordPostImpression/recordPostImpression.handler.js";
import type { PostRow } from "../../src/modules/posts/repositories/post.repository.js";
import type { HandlerContext } from "../../src/types/handlerContext.type.js";
import { authorId, buildPostRow, viewerId } from "../posts/socialPostFakes.fake.js";

const clipId = "0192f0a0-0000-7000-8000-0000000000c1";
const deletedId = "0192f0a0-0000-7000-8000-0000000000c2";
type Row = Record<string, unknown>;

function isEligible(value: unknown, condition: unknown): boolean {
  if (condition === null) return value === null || value === undefined;
  const lessThan = (condition as { lt?: Date }).lt;
  return lessThan !== undefined && value instanceof Date && value < lessThan;
}

function createStore(post: PostRow, follows: Row[] = []) {
  let now = new Date("2026-10-04T12:00:00Z");
  const viewers: Row[] = [];
  const stats = new Map<string, Row>();
  const events: { eventType: string; data: Row }[] = [];
  const posts = new Map<string, Row>([[post.id, post as unknown as Row]]);
  const emptyList = { findMany: async () => [], count: async () => 0, findFirst: async () => null, findUnique: async () => null };
  const findViewer = (where: Row) => viewers.find((row) => row["postId"] === where["postId"] && row["viewerKey"] === where["viewerKey"]);
  const client = new Proxy({
    post: {
      findFirst: async ({ where }: { where: { id: string } }) => posts.get(where.id) ?? null,
      update: async ({ where, data }: { where: { id: string }; data: Record<string, { increment: number }> }) => {
        const row = posts.get(where.id) as Row;
        for (const [key, change] of Object.entries(data)) row[key] = (row[key] as number) + change.increment;
        return row;
      },
    },
    follow: { findMany: async () => [], count: async () => 0, findFirst: async () => null, findUnique: async ({ where }: { where: { followerId_followeeId: Row } }) => follows.find((row) => row["followerId"] === where.followerId_followeeId["followerId"] && row["followeeId"] === where.followerId_followeeId["followeeId"]) ?? null },
    postViewer: {
      createMany: async ({ data }: { data: Row[] }) => {
        for (const row of data) if (findViewer(row) === undefined) viewers.push({ ...row, lastViewedAt: null, lastWatchedAt: null, lastLinkClickAt: null, lastProfileClickAt: null, followAttributedAt: null });
        return { count: 1 };
      },
      findUnique: async ({ where }: { where: { postId_viewerKey: Row } }) => findViewer(where.postId_viewerKey) ?? null,
      updateMany: async ({ where, data }: { where: Row & { OR?: Row[] }; data: Row }) => {
        const row = findViewer(where);
        if (row === undefined) return { count: 0 };
        const [field] = Object.keys(data) as [string];
        const conditions = where.OR?.map((option) => option[field]) ?? [where[field]];
        if (!conditions.some((condition) => isEligible(row[field], condition))) return { count: 0 };
        Object.assign(row, data);
        return { count: 1 };
      },
    },
    postDailyStat: {
      upsert: async ({ where, create, update }: { where: { postId_day: { postId: string; day: string } }; create: Row; update: Record<string, { increment: number }> }) => {
        const key = `${where.postId_day.postId}:${where.postId_day.day}`;
        const existing = stats.get(key);
        if (existing === undefined) stats.set(key, { ...create });
        else for (const [field, change] of Object.entries(update)) existing[field] = ((existing[field] as number | undefined) ?? 0) + change.increment;
      },
    },
    outboxEvent: { createMany: async ({ data }: { data: { eventType: string; payload: { data: Row } }[] }) => { for (const row of data) events.push({ eventType: row.eventType, data: row.payload.data }); } },
  } as Record<string, unknown>, { get: (target, key: string) => target[key] ?? emptyList });
  const context = {
    database: { client, transaction: async (work: (db: unknown) => Promise<unknown>) => work(client) },
    directory: { findUserSummaries: async () => new Map(), findPrivateAccountIds: async () => new Set() },
    clock: { now: () => now },
    premium: { isPremium: async () => false, hasSubscribedToCreator: async () => false },
    ranker: { rank: async (candidates: unknown[]) => candidates },
  } as unknown as HandlerContext;
  const stat = () => stats.get(`${post.id}:2026-10-04`) ?? {};
  return { context, events, stat, post: () => posts.get(post.id) as Row, advance: (ms: number) => { now = new Date(now.getTime() + ms); } };
}

const clip = () => buildPostRow({ id: clipId, kind: "clip", text: "New drop #ankara #ọjà", media: [{ type: "video" }] as unknown as PostRow["media"] });

describe("feed interactions", () => {
  it("counts a view once per cooldown window and repeat views after it", async () => {
    const store = createStore(clip());
    const record = createRecordFeedInteractionHandler(store.context);
    await record({ viewerId, postId: clipId, kind: "view", surface: "clips" });
    await record({ viewerId, postId: clipId, kind: "view", surface: "feed" });
    expect(store.post()["viewCount"]).toBe(1);
    store.advance(11 * 60_000);
    await record({ viewerId, postId: clipId, kind: "view", surface: "clips" });
    expect(store.post()["viewCount"]).toBe(2);
    expect(store.stat()["impressions"]).toBe(2);
  });

  it("ignores every interaction from the author and from guests", async () => {
    const store = createStore(clip());
    const record = createRecordFeedInteractionHandler(store.context);
    await record({ viewerId: authorId, postId: clipId, kind: "view" });
    await record({ viewerId: undefined, postId: clipId, kind: "watch", watchMs: 1000, durationMs: 1000 });
    expect(store.post()["viewCount"]).toBe(0);
    expect(store.events).toHaveLength(0);
  });

  it("clamps an absurd watch time to the clip length times its plays and records completion", async () => {
    const store = createStore(clip());
    await createRecordFeedInteractionHandler(store.context)({ viewerId, postId: clipId, kind: "watch", watchMs: 3_600_000, durationMs: 15_000, loopCount: 1, watchFraction: 1 });
    expect(store.stat()).toMatchObject({ videoViews: 1, watchTimeSeconds: 30, completedViews: 1 });
    expect(store.events).toEqual([expect.objectContaining({ eventType: "clip.watched", data: expect.objectContaining({ watchMs: 30_000, hashtags: ["ankara"] }) })]);
  });

  it("does not record a watch on a post without video", async () => {
    const store = createStore(buildPostRow({ id: clipId }));
    await createRecordFeedInteractionHandler(store.context)({ viewerId, postId: clipId, kind: "watch", watchMs: 5000, durationMs: 5000 });
    expect(store.stat()).toEqual({});
  });

  it("emits dwell only after a counted view", async () => {
    const store = createStore(clip());
    const record = createRecordFeedInteractionHandler(store.context);
    await record({ viewerId, postId: clipId, kind: "dwell", dwellMs: 4000 });
    expect(store.events).toHaveLength(0);
    await record({ viewerId, postId: clipId, kind: "view" });
    await record({ viewerId, postId: clipId, kind: "dwell", dwellMs: 4000, position: 2 });
    expect(store.events).toEqual([expect.objectContaining({ eventType: "post.viewed", data: expect.objectContaining({ actorId: viewerId, dwellMs: 4000, position: 2 }) })]);
  });

  it("SOC-05: repeated dwell events in one cooldown window emit a single post.viewed", async () => {
    const store = createStore(clip());
    const batch = createRecordFeedInteractionBatchHandler(createRecordFeedInteractionHandler(store.context));
    await batch({ viewerId, events: [{ postId: clipId, kind: "view" }, ...Array.from({ length: 49 }, () => ({ postId: clipId, kind: "dwell" as const, dwellMs: 20_000 }))] });
    expect(store.events.filter((event) => event.eventType === "post.viewed")).toHaveLength(1);
    store.advance(11 * 60_000);
    await batch({ viewerId, events: [{ postId: clipId, kind: "dwell", dwellMs: 20_000 }, { postId: clipId, kind: "dwell", dwellMs: 20_000 }] });
    expect(store.events.filter((event) => event.eventType === "post.viewed")).toHaveLength(2);
  });

  it("attributes a follow once, and only when the viewer really follows the author", async () => {
    const unfollowed = createStore(clip());
    await createRecordFeedInteractionHandler(unfollowed.context)({ viewerId, postId: clipId, kind: "follow" });
    expect(unfollowed.stat()).toEqual({});
    const store = createStore(clip(), [{ followerId: viewerId, followeeId: authorId, state: "accepted" }]);
    const record = createRecordFeedInteractionHandler(store.context);
    await record({ viewerId, postId: clipId, kind: "follow" });
    store.advance(3_600_000);
    await record({ viewerId, postId: clipId, kind: "follow" });
    expect(store.stat()["newFollows"]).toBe(1);
  });

  it("throttles profile and link clicks per viewer", async () => {
    const store = createStore(clip());
    const record = createRecordFeedInteractionHandler(store.context);
    for (let index = 0; index < 3; index += 1) {
      await record({ viewerId, postId: clipId, kind: "profile_click" });
      await record({ viewerId, postId: clipId, kind: "link_click" });
    }
    expect(store.post()["profileVisitCount"]).toBe(1);
    expect(store.stat()["linkClicks"]).toBe(1);
  });

  it("shares the view cooldown with the legacy impression endpoint", async () => {
    const store = createStore(clip());
    await createRecordPostImpressionHandler(store.context)({ viewerId, postId: clipId });
    await createRecordFeedInteractionHandler(store.context)({ viewerId, postId: clipId, kind: "view" });
    expect(store.post()["viewCount"]).toBe(1);
  });

  it("skips deleted posts in a batch without failing the rest", async () => {
    const store = createStore(clip());
    const batch = createRecordFeedInteractionBatchHandler(createRecordFeedInteractionHandler(store.context));
    const result = await batch({ viewerId, events: [{ postId: deletedId, kind: "view" }, { postId: clipId, kind: "view" }] });
    expect(result).toEqual({ accepted: 1, skipped: 1 });
    expect(store.post()["viewCount"]).toBe(1);
  });

  it("caps the batch size and rejects absurd values", () => {
    const event = { postId: clipId, kind: "view" };
    expect(feedInteractionBatchBodySchema.safeParse({ events: Array.from({ length: 51 }, () => event) }).success).toBe(false);
    expect(feedInteractionBatchBodySchema.safeParse({ events: [] }).success).toBe(false);
    expect(feedInteractionBatchBodySchema.safeParse({ events: [{ ...event, kind: "watch", watchMs: 10_000_000 }] }).success).toBe(false);
    expect(feedInteractionBatchBodySchema.safeParse({ events: [{ ...event, kind: "watch", watchFraction: 2 }] }).success).toBe(false);
    expect(feedInteractionBatchBodySchema.safeParse({ events: [{ ...event, surface: "Feed!" }] }).success).toBe(false);
    expect(feedInteractionBatchBodySchema.safeParse({ events: [event] }).success).toBe(true);
  });

  it("derives average watch time and completion rate", () => {
    expect(buildVideoAnalytics(4, 30, 3)).toEqual({ views: 4, watchTimeSeconds: 30, completedViews: 3, averageWatchSeconds: 7.5, completionRate: 0.75 });
    expect(buildVideoAnalytics(0, 0, 0)).toMatchObject({ averageWatchSeconds: 0, completionRate: 0 });
  });
});
