import { describe, expect, it } from "vitest";

import { createApplyContentVisibilityHandler } from "../../src/modules/contentEvents/commands/applyContentVisibility/applyContentVisibility.handler.js";
import { createDeletePostHandler } from "../../src/modules/posts/commands/deletePost/deletePost.handler.js";
import { createPinPostHandler } from "../../src/modules/posts/commands/pinPost/pinPost.handler.js";
import { createUnpinPostHandler } from "../../src/modules/posts/commands/unpinPost/unpinPost.handler.js";
import { createPinStore, postId } from "../comments/pinStore.fake.js";
import { authorId, buildPostRow, viewerId } from "./socialPostFakes.fake.js";

const pinnedAt = new Date("2026-10-04T11:30:00Z");

function storeWithOtherPins(count: number, overrides: Record<string, unknown> = {}) {
  const store = createPinStore([], overrides);
  for (let index = 0; index < count; index += 1) {
    store.posts.push({ ...buildPostRow({ id: `0192f0a0-0000-7000-8000-0000000001${String(index).padStart(2, "0")}`, authorId }), isPinned: true, pinnedAt, pinnedCommentId: null });
  }
  return store;
}

describe("post pins", () => {
  it("rejects pinning or unpinning another author's post", async () => {
    const { context } = storeWithOtherPins(0);
    await expect(createPinPostHandler(context)({ actorId: viewerId, postId })).rejects.toMatchObject({ status: 403 });
    await expect(createUnpinPostHandler(context)({ actorId: viewerId, postId })).rejects.toMatchObject({ status: 403 });
  });

  it("pins a post, exposes it in the view and emits post.pinned", async () => {
    const store = storeWithOtherPins(2);
    const view = await createPinPostHandler(store.context)({ actorId: authorId, postId });
    expect(view).toMatchObject({ isPinned: true, pinnedAt: "2026-10-04T12:00:00.000Z", pinnedCommentId: null });
    expect(store.events).toEqual([{ eventType: "post.pinned", data: { postId, authorId, kind: "post" } }]);
  });

  it("rejects a fourth pinned post", async () => {
    const store = storeWithOtherPins(3);
    await expect(createPinPostHandler(store.context)({ actorId: authorId, postId })).rejects.toMatchObject({ status: 409, code: "PIN_LIMIT_REACHED" });
    expect(store.posts[0]?.["isPinned"]).toBe(false);
  });

  it("does not count deleted pinned posts toward the limit", async () => {
    const store = storeWithOtherPins(3);
    (store.posts[1] as Record<string, unknown>)["deletedAt"] = pinnedAt;
    expect((await createPinPostHandler(store.context)({ actorId: authorId, postId })).isPinned).toBe(true);
  });

  it("re-pinning an already pinned post is a no-op even at the limit", async () => {
    const store = storeWithOtherPins(2, { isPinned: true, pinnedAt });
    const view = await createPinPostHandler(store.context)({ actorId: authorId, postId });
    expect(view.pinnedAt).toBe(pinnedAt.toISOString());
    expect(store.events).toHaveLength(0);
  });

  it("refuses to pin a story", async () => {
    const store = storeWithOtherPins(0, { kind: "story" });
    await expect(createPinPostHandler(store.context)({ actorId: authorId, postId })).rejects.toMatchObject({ status: 422, code: "POST_NOT_PINNABLE" });
  });

  it("unpins a post", async () => {
    const store = storeWithOtherPins(0, { isPinned: true, pinnedAt });
    const view = await createUnpinPostHandler(store.context)({ actorId: authorId, postId });
    expect(view).toMatchObject({ isPinned: false, pinnedAt: null });
    expect(store.events.map((event) => event.eventType)).toEqual(["post.unpinned"]);
  });

  it("drops the pin when the post is deleted or hidden by moderation", async () => {
    const deleted = storeWithOtherPins(0, { isPinned: true, pinnedAt });
    await createDeletePostHandler(deleted.context)({ actorId: authorId, postId });
    expect(deleted.posts[0]).toMatchObject({ isPinned: false, pinnedAt: null });
    const hidden = storeWithOtherPins(0, { isPinned: true, pinnedAt });
    await createApplyContentVisibilityHandler(hidden.context)({ targetType: "post", targetId: postId, visibility: "removed", occurredAt: pinnedAt });
    expect(hidden.posts[0]).toMatchObject({ isPinned: false, pinnedAt: null, moderationVisibility: "removed" });
  });
});
