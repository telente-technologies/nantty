import { describe, expect, it, vi } from "vitest";

import { publishedPostToViewers } from "../../src/constants/moderation.constant.js";
import { publishDueScheduledPosts } from "../../src/jobs/publishScheduledPosts.job.js";
import { createScheduledPostsController } from "../../src/modules/posts/controllers/scheduledPosts.controller.js";
import { createCreatePostHandler } from "../../src/modules/posts/commands/createPost/createPost.handler.js";
import type { CreatePostCommand } from "../../src/modules/posts/commands/createPost/createPost.command.js";
import { createPostBodySchema } from "../../src/modules/posts/validators/posts.validator.js";
import { createMemoryStore, type Row } from "../comments/memoryDb.fake.js";
import { authorId, buildPostRow, viewerId } from "./socialPostFakes.fake.js";
import type { RouteFactory } from "../../src/utils/route.util.js";

const targetId = "0192f0a0-0000-7000-8000-0000000000e1";
const now = new Date("2026-10-10T12:00:00.000Z");

function createStore() {
  const store = createMemoryStore({
    posts: [{ ...buildPostRow({ id: targetId, authorId, text: "Original" }) } as Row],
    postDefaults: () => ({ ...buildPostRow({}), id: undefined }),
  });
  store.now = now;
  return store;
}

function command(extra: Partial<CreatePostCommand> = {}): CreatePostCommand {
  return {
    authorId: viewerId,
    kind: "post",
    text: "Scheduled post",
    mediaIds: [],
    audience: "everyone",
    visibility: "public",
    isAiGenerated: false,
    soundId: undefined,
    mentions: undefined,
    replyToComment: undefined,
    stickerLayout: undefined,
    ...extra,
  };
}

describe("scheduled post creation and publication", () => {
  it("accepts explicit timezone offsets and rejects timezone-ambiguous values", () => {
    expect(createPostBodySchema.safeParse({ text: "later", scheduledAt: "2026-10-10T15:00:00+03:00" }).success).toBe(true);
    expect(createPostBodySchema.safeParse({ text: "later", scheduledAt: "2026-10-10T15:00:00" }).success).toBe(false);
    expect(createPostBodySchema.safeParse({ text: "later", scheduledAt: "not-a-date" }).success).toBe(false);
  });

  it("keeps a scheduled quote private and defers events and quote counters", async () => {
    const store = createStore();
    store.context.premium.canSchedulePosts = async () => true;
    const createPost = createCreatePostHandler(store.context);
    const post = await createPost(command({ quotedPostId: targetId, scheduledAt: "2026-10-10T12:10:00.000Z" }));
    const created = store.posts.find((row) => row["id"] === post.id);
    const original = store.posts.find((row) => row["id"] === targetId);

    expect(post).toMatchObject({ publicationState: "scheduled", scheduledAt: "2026-10-10T12:10:00.000Z" });
    expect(created).toMatchObject({ publicationState: "scheduled", scheduledTaggedUserIds: [] });
    expect(original?.["quoteCount"]).toBe(0);
    expect(store.events).toHaveLength(0);
    expect(publishedPostToViewers).toMatchObject({ publicationState: "published" });
  });

  it("requires a paid scheduling entitlement scoped to the verified posting profile", async () => {
    const denied = createStore();
    const deniedCreate = createCreatePostHandler(denied.context);
    await expect(deniedCreate(command({ scheduledAt: "2026-10-10T12:10:00.000Z" }))).rejects.toMatchObject({ code: "PAID_SCHEDULING_REQUIRED" });
    expect(denied.posts).toHaveLength(1);

    const allowed = createStore();
    const profileId = "0192f0a0-0000-7000-8000-0000000000f1";
    const canSchedule = vi.fn(async (_accountId: string, requestedProfileId?: string) => requestedProfileId === profileId);
    allowed.context.premium.canSchedulePosts = canSchedule;
    allowed.context.directory.findOwnedPostableProfile = async (_accountId, requestedProfileId) => requestedProfileId === profileId ? { id: profileId, accountId: viewerId, kind: "business", displayName: "Sample store", handle: "sample-store", avatarUrl: null } : null;
    await expect(createCreatePostHandler(allowed.context)(command({ asProfileId: profileId, scheduledAt: "2026-10-10T12:10:00.000Z" }))).resolves.toMatchObject({ publicationState: "scheduled" });
    expect(canSchedule).toHaveBeenCalledWith(viewerId, profileId);
  });

  it("rejects too-soon, too-far, and non-feed schedules", async () => {
    const createPost = createCreatePostHandler(createStore().context);
    await expect(createPost(command({ scheduledAt: "2026-10-10T12:00:30.000Z" }))).rejects.toMatchObject({ code: "SCHEDULE_TOO_SOON" });
    await expect(createPost(command({ scheduledAt: "2027-01-10T12:00:00.000Z" }))).rejects.toMatchObject({ code: "SCHEDULE_TOO_FAR" });
    await expect(createPost(command({ kind: "clip", scheduledAt: "2026-10-10T12:10:00.000Z" }))).rejects.toMatchObject({ code: "SCHEDULED_POST_ONLY" });
    await expect(createPost(command({ replyToComment: { commentId: targetId, clipId: targetId, commenterUserId: authorId }, scheduledAt: "2026-10-10T12:10:00.000Z" }))).rejects.toMatchObject({ code: "SCHEDULED_POST_ONLY" });
  });

  it("publishes due posts once, waits for processing media, and fails terminal media", async () => {
    const store = createStore();
    const due = { ...buildPostRow({ id: "0192f0a0-0000-7000-8000-0000000000e2", authorId: viewerId, publicationState: "scheduled", scheduledAt: new Date("2026-10-10T11:59:00Z") }) } as Row;
    const waiting = { ...buildPostRow({ id: "0192f0a0-0000-7000-8000-0000000000e3", authorId: viewerId, publicationState: "scheduled", scheduledAt: new Date("2026-10-10T11:59:00Z"), media: [{ id: "media-processing", postId: "0192f0a0-0000-7000-8000-0000000000e3", mediaId: "processing-media", position: 0, type: "image", url: null, posterUrl: null, hlsUrl: null, width: null, height: null, durationSeconds: null, blurhash: null, status: "processing" }] }) } as Row;
    const failed = { ...buildPostRow({ id: "0192f0a0-0000-7000-8000-0000000000e4", authorId: viewerId, publicationState: "scheduled", scheduledAt: new Date("2026-10-10T11:59:00Z"), media: [{ id: "media-failed", postId: "0192f0a0-0000-7000-8000-0000000000e4", mediaId: "failed-media", position: 0, type: "image", url: null, posterUrl: null, hlsUrl: null, width: null, height: null, durationSeconds: null, blurhash: null, status: "failed" }] }) } as Row;
    const suspended = { ...buildPostRow({ id: "0192f0a0-0000-7000-8000-0000000000e5", authorId: "0192f0a0-0000-7000-8000-00000000b002", publicationState: "scheduled", scheduledAt: new Date("2026-10-10T11:59:00Z") }) } as Row;
    store.posts.push(due, waiting, failed);
    store.posts.push(suspended);
    store.context.directory.findMentionTargetStatuses = async (ids) => new Map(ids.map((id) => [id, { username: null, status: id === suspended["authorId"] ? "suspended" as const : "active" as const }]));

    const result = await publishDueScheduledPosts(store.context, now);
    expect(result).toEqual({ published: 1, failed: 2, waitingForMedia: 1 });
    expect(due).toMatchObject({ publicationState: "published", scheduledAt: null, createdAt: now });
    expect(waiting["publicationState"]).toBe("scheduled");
    expect(failed["publicationState"]).toBe("failed");
    expect(suspended).toMatchObject({ publicationState: "failed", publicationFailureReason: "author_unavailable" });
    expect(store.events.map((event) => (event["payload"] as Row)["type"])).toContain("post.created");

    const concurrentResults = await Promise.all([publishDueScheduledPosts(store.context, now), publishDueScheduledPosts(store.context, now)]);
    expect(concurrentResults.reduce((total, item) => total + item.published, 0)).toBe(0);
    expect(store.events.filter((event) => (event["payload"] as Row)["type"] === "post.created")).toHaveLength(1);
  });

  it("scopes schedule listing and every schedule mutation to the authenticated author", async () => {
    const authorWhere: Row[] = [];
    const definitions: { authentication: string }[] = [];
    const post = {
      findMany: vi.fn(async ({ where }: { where: Row }) => { authorWhere.push(where); return []; }),
      findFirst: vi.fn(async ({ where }: { where: Row }) => { authorWhere.push(where); return { authorProfileId: null }; }),
      updateMany: vi.fn(async ({ where }: { where: Row }) => { authorWhere.push(where); return { count: 1 }; }),
    };
    const context = {
      database: { client: { post } },
      clock: { now: () => now },
      premium: { canSchedulePosts: vi.fn(async () => true) },
    } as never;
    const route = ((definition: { authentication: string }, handler: unknown) => {
      definitions.push(definition);
      return handler;
    }) as unknown as RouteFactory;
    const controller = createScheduledPostsController(route, context);
    const request = { principal: { accountId: viewerId }, params: { postId: targetId }, body: { scheduledAt: "2026-10-10T12:30:00.000Z" } };

    await (controller.list as unknown as (input: unknown) => Promise<unknown>)({ principal: { accountId: viewerId }, query: { cursor: undefined, limit: 20 } });
    await (controller.reschedule as unknown as (input: unknown) => Promise<unknown>)(request);
    await (controller.publishNow as unknown as (input: unknown) => Promise<unknown>)(request);
    await (controller.cancel as unknown as (input: unknown) => Promise<unknown>)(request);

    expect(definitions).toHaveLength(5);
    expect(definitions.every((definition) => definition.authentication === "required")).toBe(true);
    expect(authorWhere).toHaveLength(5);
    expect(authorWhere.every((where) => where["authorId"] === viewerId)).toBe(true);
    expect(authorWhere.slice(1).every((where) => where["id"] === targetId && where["publicationState"] !== undefined)).toBe(true);
  });

  it("isolates per-post transactions and cancels posts hidden by moderation before publication", async () => {
    const store = createStore();
    const hidden = { ...buildPostRow({ id: "0192f0a0-0000-7000-8000-0000000000f5", authorId: viewerId, publicationState: "scheduled", moderationVisibility: "hidden", scheduledAt: new Date("2026-10-10T11:58:00Z") }) } as Row;
    const flaky = { ...buildPostRow({ id: "0192f0a0-0000-7000-8000-0000000000f6", authorId: "0192f0a0-0000-7000-8000-00000000b099", publicationState: "scheduled", scheduledAt: new Date("2026-10-10T11:58:30Z") }) } as Row;
    const healthy = { ...buildPostRow({ id: "0192f0a0-0000-7000-8000-0000000000f7", authorId: viewerId, publicationState: "scheduled", scheduledAt: new Date("2026-10-10T11:59:00Z") }) } as Row;
    store.posts.push(hidden, flaky, healthy);
    store.context.directory.findMentionTargetStatuses = async (ids) => {
      if (ids.includes("0192f0a0-0000-7000-8000-00000000b099")) throw new Error("transient directory outage");
      return new Map(ids.map((id) => [id, { username: null, status: "active" as const }]));
    };

    const result = await publishDueScheduledPosts(store.context, now);
    expect(result).toEqual({ published: 1, failed: 1, waitingForMedia: 0 });
    expect(hidden).toMatchObject({ publicationState: "cancelled", scheduledAt: null });
    expect(flaky).toMatchObject({ publicationState: "scheduled" });
    expect(healthy).toMatchObject({ publicationState: "published", createdAt: now });
  });

  it("updates scheduled post text and audience when entitled and preserves existing mentions", async () => {
    const store = createStore();
    store.context.premium.canSchedulePosts = async () => true;
    const mention = { start: 0, length: 5, userId: authorId };
    const scheduled = { ...buildPostRow({ id: "0192f0a0-0000-7000-8000-0000000000f8", authorId: viewerId, text: "@alex Before", mentions: [mention], publicationState: "scheduled", scheduledAt: new Date("2026-10-10T13:00:00Z") }) } as Row;
    store.posts.push(scheduled);
    const route = ((_definition: unknown, handler: unknown) => handler) as unknown as RouteFactory;
    const controller = createScheduledPostsController(route, store.context);

    await expect((controller.editContent as unknown as (input: unknown) => Promise<unknown>)(
      { principal: { accountId: viewerId }, params: { postId: scheduled["id"] }, body: {} },
    )).rejects.toMatchObject({ code: "EMPTY_UPDATE" });

    const updated = await (controller.editContent as unknown as (input: unknown) => Promise<{ id: string; text: string; status: string }>)(
      { principal: { accountId: viewerId }, params: { postId: scheduled["id"] }, body: { text: "@alex After edit", audience: "followers", topics: ["art"] } },
    );
    expect(updated).toMatchObject({ id: scheduled["id"], text: "@alex After edit", status: "scheduled" });
    expect(scheduled).toMatchObject({ text: "@alex After edit", audience: "followers", topics: ["art"], mentions: [mention] });
  });

  it("denies rescheduling when the exact profile is not entitled and preserves the scheduled row", async () => {
    const post = {
      findFirst: vi.fn(async () => ({ authorProfileId: "business-profile" })),
      updateMany: vi.fn(async () => ({ count: 1 })),
    };
    const canSchedulePosts = vi.fn(async () => false);
    const route = ((_definition: unknown, handler: unknown) => handler) as unknown as RouteFactory;
    const controller = createScheduledPostsController(route, {
      database: { client: { post } },
      clock: { now: () => now },
      premium: { canSchedulePosts },
    } as never);

    await expect((controller.reschedule as unknown as (input: unknown) => Promise<unknown>)({
      principal: { accountId: viewerId },
      params: { postId: targetId },
      body: { scheduledAt: "2026-10-10T12:30:00.000Z" },
    })).rejects.toMatchObject({ code: "PAID_SCHEDULING_REQUIRED" });
    expect(canSchedulePosts).toHaveBeenCalledWith(viewerId, "business-profile");
    expect(post.updateMany).not.toHaveBeenCalled();
  });

  it("returns scheduled posts in bounded cursor pages", async () => {
    const rows = [1, 2, 3].map((number) => buildPostRow({
      id: `0192f0a0-0000-7000-8000-00000000000${number}`,
      authorId: viewerId,
      publicationState: "scheduled",
      scheduledAt: new Date(`2026-10-10T12:0${number}:00.000Z`),
    }));
    const findMany = vi.fn(async () => rows);
    const route = ((_definition: unknown, handler: unknown) => handler) as unknown as RouteFactory;
    const controller = createScheduledPostsController(route, {
      database: { client: { post: { findMany } } },
      clock: { now: () => now },
    } as never);

    const result = await (controller.list as unknown as (input: unknown) => Promise<{ data: { id: string }[]; nextCursor: string | null }>)(
      { principal: { accountId: viewerId }, query: { cursor: "0192f0a0-0000-7000-8000-000000000009", limit: 2 } },
    );
    expect(findMany).toHaveBeenCalledWith(expect.objectContaining({
      take: 3,
      cursor: { id: "0192f0a0-0000-7000-8000-000000000009" },
      skip: 1,
      orderBy: [{ scheduledAt: "asc" }, { createdAt: "desc" }, { id: "asc" }],
    }));
    expect(result.data.map((post) => post.id)).toEqual(rows.slice(0, 2).map((post) => post.id));
    expect(result.nextCursor).toBe(rows[1]?.id);
  });
});
