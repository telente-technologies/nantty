import { describe, expect, it } from "vitest";

import { createDeletePostHandler } from "../../src/modules/posts/commands/deletePost/deletePost.handler.js";
import type { HandlerContext } from "../../src/types/handlerContext.type.js";
import { authorId, buildPostRow, viewerId } from "./socialPostFakes.fake.js";

type Row = Record<string, unknown>;

const postId = "0192f0a0-0000-7000-8000-0000000000d1";
const originalId = "0192f0a0-0000-7000-8000-0000000000d2";
const brandProfileId = "0192f0a0-0000-7000-8000-0000000000e1";
const teammateId = "0192f0a0-0000-7000-8000-0000000000e2";

function matches(row: Row, where: Row): boolean {
  return Object.entries(where).every(([key, condition]) => {
    const value = row[key] ?? null;
    if (condition !== null && typeof condition === "object") {
      const operators = condition as { in?: unknown[]; gt?: number };
      if (operators.in !== undefined) return operators.in.includes(value);
      if (operators.gt !== undefined) return typeof value === "number" && value > operators.gt;
    }
    return value === condition;
  });
}

function applyData(row: Row, data: Row): void {
  for (const [key, value] of Object.entries(data)) {
    const decrement = (value as { decrement?: number } | null)?.decrement;
    row[key] = typeof decrement === "number" ? (row[key] as number) - decrement : value;
  }
}

function createStore(postOverrides: Row = {}, options: { readonly ownedProfiles?: readonly string[]; readonly failMedia?: boolean } = {}) {
  const posts: Row[] = [
    { ...buildPostRow({ id: postId, authorId }), authorProfileId: null, isPinned: false, pinnedAt: null, media: [{ mediaId: "m-1" }, { mediaId: "m-2" }], ...postOverrides },
    { ...buildPostRow({ id: originalId, authorId: viewerId }), repostCount: 1, quoteCount: 1, media: [] },
  ];
  const savedItems: Row[] = [{ userId: viewerId, type: "post", targetId: postId }, { userId: viewerId, type: "post", targetId: originalId }];
  const saveCounters: Row[] = [{ type: "post", targetId: postId, count: 1 }];
  const events: { eventType: string; data: Row }[] = [];
  const mediaCalls: string[][] = [];
  const deleteWhere = (rows: Row[]) => async ({ where }: { where: Row }) => {
    const before = rows.length;
    for (let index = rows.length - 1; index >= 0; index -= 1) if (matches(rows[index] as Row, where)) rows.splice(index, 1);
    return { count: before - rows.length };
  };
  const client = {
    post: {
      findFirst: async ({ where }: { where: Row }) => posts.find((row) => matches(row, where)) ?? null,
      updateMany: async ({ where, data }: { where: Row; data: Row }) => {
        const hits = posts.filter((row) => matches(row, where));
        for (const row of hits) applyData(row, data);
        return { count: hits.length };
      },
    },
    savedItem: { deleteMany: deleteWhere(savedItems) },
    saveCounter: { deleteMany: deleteWhere(saveCounters) },
    outboxEvent: { createMany: async ({ data }: { data: { eventType: string; payload: { data: Row } }[] }) => void events.push(...data.map((event) => ({ eventType: event.eventType, data: event.payload.data }))) },
  };
  const context = {
    database: { client, transaction: async (work: (db: unknown) => Promise<unknown>) => work(client) },
    directory: { findOwnedPostableProfile: async (accountId: string, profileId: string) => ((options.ownedProfiles ?? []).includes(`${accountId}:${profileId}`) ? { id: profileId, kind: "brand" } : null) },
    clock: { now: () => new Date("2026-10-04T12:00:00Z") },
    postMedia: { deleteMedia: async (ids: readonly string[]) => { mediaCalls.push([...ids]); if (options.failMedia) throw new Error("media down"); } },
  } as unknown as HandlerContext;
  return { posts, savedItems, saveCounters, events, mediaCalls, context, post: posts[0] as Row, original: posts[1] as Row };
}

describe("delete post", () => {
  it("soft-deletes, clears saves, deletes media and emits post.deleted", async () => {
    const store = createStore();
    await createDeletePostHandler(store.context)({ actorId: authorId, postId });
    expect(store.post["deletedAt"]).toEqual(new Date("2026-10-04T12:00:00Z"));
    expect(store.savedItems.map((row) => row["targetId"])).toEqual([originalId]);
    expect(store.saveCounters).toHaveLength(0);
    expect(store.mediaCalls).toEqual([["m-1", "m-2"]]);
    expect(store.events).toEqual([{ eventType: "post.deleted", data: expect.objectContaining({ postId, authorId, kind: "post", reason: "author", mediaIds: ["m-1", "m-2"] }) }]);
  });

  it("is idempotent: a second delete is a no-op that emits nothing new", async () => {
    const store = createStore();
    const remove = createDeletePostHandler(store.context);
    await remove({ actorId: authorId, postId });
    await expect(remove({ actorId: authorId, postId })).resolves.toBeUndefined();
    expect(store.events).toHaveLength(1);
  });

  it("returns 403 to a non-owner and leaves the post intact", async () => {
    const store = createStore();
    await expect(createDeletePostHandler(store.context)({ actorId: viewerId, postId })).rejects.toMatchObject({ status: 403, code: "NOT_POST_OWNER" });
    expect(store.post["deletedAt"]).toBeNull();
    expect(store.events).toHaveLength(0);
  });

  it("returns 403 to a non-owner even after the post was deleted", async () => {
    const store = createStore({ deletedAt: new Date("2026-10-04T11:00:00Z") });
    await expect(createDeletePostHandler(store.context)({ actorId: viewerId, postId })).rejects.toMatchObject({ status: 403 });
  });

  it("returns 404 for an unknown post", async () => {
    const store = createStore();
    await expect(createDeletePostHandler(store.context)({ actorId: authorId, postId: "0192f0a0-0000-7000-8000-0000000000ff" })).rejects.toMatchObject({ status: 404 });
  });

  it("lets a teammate who owns the brand profile delete a brand post", async () => {
    const store = createStore({ authorProfileId: brandProfileId }, { ownedProfiles: [`${teammateId}:${brandProfileId}`] });
    await createDeletePostHandler(store.context)({ actorId: teammateId, postId });
    expect(store.post["deletedAt"]).not.toBeNull();
    expect(store.events[0]?.data).toMatchObject({ authorId, deletedBy: teammateId, authorProfileId: brandProfileId });
  });

  it("unpins a pinned post and records that it was pinned", async () => {
    const store = createStore({ isPinned: true, pinnedAt: new Date("2026-10-04T11:00:00Z") });
    await createDeletePostHandler(store.context)({ actorId: authorId, postId });
    expect(store.post).toMatchObject({ isPinned: false, pinnedAt: null });
    expect(store.events[0]?.data).toMatchObject({ wasPinned: true });
  });

  it("decrements the quoted post's counters once, never below zero", async () => {
    const store = createStore({ resharedFromId: originalId, isQuote: true });
    const remove = createDeletePostHandler(store.context);
    await remove({ actorId: authorId, postId });
    await remove({ actorId: authorId, postId });
    expect(store.original).toMatchObject({ repostCount: 0, quoteCount: 0 });
    expect(store.events[0]?.data).toMatchObject({ quotedPostId: originalId });
  });

  it("deleting a scheduled quote has no public deletion event or quote-counter effect", async () => {
    const store = createStore({ publicationState: "scheduled", scheduledAt: new Date("2026-10-05T12:00:00Z"), resharedFromId: originalId, isQuote: true });
    await createDeletePostHandler(store.context)({ actorId: authorId, postId });
    expect(store.post).toMatchObject({ deletedAt: new Date("2026-10-04T12:00:00Z"), publicationState: "cancelled", scheduledAt: null });
    expect(store.original).toMatchObject({ repostCount: 1, quoteCount: 1 });
    expect(store.events).toHaveLength(0);
    expect(store.mediaCalls).toEqual([["m-1", "m-2"]]);
  });

  it("deleting a post that others quote leaves the quotes in place", async () => {
    const store = createStore();
    store.posts.push({ ...buildPostRow({ id: "0192f0a0-0000-7000-8000-0000000000d3", authorId: viewerId }), resharedFromId: postId, isQuote: true, media: [] });
    await createDeletePostHandler(store.context)({ actorId: authorId, postId });
    expect(store.posts[2]).toMatchObject({ deletedAt: null, resharedFromId: postId });
  });

  it("still deletes when the media service is down, and retries media on a repeat delete", async () => {
    const store = createStore({}, { failMedia: true });
    const remove = createDeletePostHandler(store.context);
    await remove({ actorId: authorId, postId });
    await remove({ actorId: authorId, postId });
    expect(store.post["deletedAt"]).not.toBeNull();
    expect(store.mediaCalls).toHaveLength(2);
  });

  it("deletes stories and clips the same way", async () => {
    for (const kind of ["story", "clip"] as const) {
      const store = createStore({ kind });
      await createDeletePostHandler(store.context)({ actorId: authorId, postId });
      expect(store.events[0]?.data).toMatchObject({ kind });
    }
  });
});
