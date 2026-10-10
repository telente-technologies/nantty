import { describe, expect, it } from "vitest";

import { createDeleteCommentHandler } from "../../src/modules/comments/commands/deleteComment/deleteComment.handler.js";
import { createPinCommentHandler } from "../../src/modules/comments/commands/pinComment/pinComment.handler.js";
import { createUnpinCommentHandler } from "../../src/modules/comments/commands/unpinComment/unpinComment.handler.js";
import { createApplyContentVisibilityHandler } from "../../src/modules/contentEvents/commands/applyContentVisibility/applyContentVisibility.handler.js";
import { authorId, viewerId } from "../posts/socialPostFakes.fake.js";
import { buildComment, createPinStore, firstId, postId, replyId, secondId } from "./pinStore.fake.js";

const pinnedAt = new Date("2026-10-04T11:30:00Z");

describe("comment pins", () => {
  it("rejects pinning or unpinning when the actor is not the post author", async () => {
    const { context } = createPinStore([buildComment({ id: firstId })]);
    await expect(createPinCommentHandler(context)({ actorId: viewerId, postId, commentId: firstId })).rejects.toMatchObject({ status: 403 });
    await expect(createUnpinCommentHandler(context)({ actorId: viewerId, postId, commentId: firstId })).rejects.toMatchObject({ status: 403 });
  });

  it("pins a comment, replaces the previous pin and emits comment.pinned", async () => {
    const store = createPinStore([buildComment({ id: firstId, isPinned: true, pinnedAt }), buildComment({ id: secondId })], { pinnedCommentId: firstId });
    const view = await createPinCommentHandler(store.context)({ actorId: authorId, postId, commentId: secondId });
    expect(view).toMatchObject({ id: secondId, isPinned: true, pinnedAt: "2026-10-04T12:00:00.000Z" });
    expect(store.comments.find((comment) => comment.id === firstId)).toMatchObject({ isPinned: false, pinnedAt: null });
    expect(store.posts[0]?.["pinnedCommentId"]).toBe(secondId);
    expect(store.events).toEqual([{ eventType: "comment.pinned", data: expect.objectContaining({ commentId: secondId, postId, pinnedBy: authorId, replacedCommentId: firstId }) }]);
  });

  it("treats pinning the already pinned comment as a no-op", async () => {
    const store = createPinStore([buildComment({ id: firstId, isPinned: true, pinnedAt })], { pinnedCommentId: firstId });
    const view = await createPinCommentHandler(store.context)({ actorId: authorId, postId, commentId: firstId });
    expect(view.isPinned).toBe(true);
    expect(store.events).toHaveLength(0);
  });

  it("refuses to pin a reply", async () => {
    const store = createPinStore([buildComment({ id: firstId }), buildComment({ id: replyId, parentCommentId: firstId, rootCommentId: firstId, depth: 1 })]);
    await expect(createPinCommentHandler(store.context)({ actorId: authorId, postId, commentId: replyId })).rejects.toMatchObject({ status: 422, code: "COMMENT_NOT_PINNABLE" });
  });

  it("returns 404 for a comment on another post", async () => {
    const store = createPinStore([buildComment({ id: firstId, postId: "0192f0a0-0000-7000-8000-0000000000ff" })]);
    await expect(createPinCommentHandler(store.context)({ actorId: authorId, postId, commentId: firstId })).rejects.toMatchObject({ status: 404 });
  });

  it("unpins a comment and clears the post pointer", async () => {
    const store = createPinStore([buildComment({ id: firstId, isPinned: true, pinnedAt })], { pinnedCommentId: firstId });
    await createUnpinCommentHandler(store.context)({ actorId: authorId, postId, commentId: firstId });
    expect(store.comments[0]).toMatchObject({ isPinned: false, pinnedAt: null });
    expect(store.posts[0]?.["pinnedCommentId"]).toBeNull();
    expect(store.events.map((event) => event.eventType)).toEqual(["comment.unpinned"]);
  });

  it("clears the pin when the pinned comment is deleted", async () => {
    const store = createPinStore([buildComment({ id: firstId, isPinned: true, pinnedAt })], { pinnedCommentId: firstId });
    await createDeleteCommentHandler(store.context)({ actorId: viewerId, commentId: firstId });
    expect(store.comments[0]).toMatchObject({ isPinned: false, pinnedAt: null });
    expect(store.posts[0]?.["pinnedCommentId"]).toBeNull();
  });

  it("clears the pin when moderation hides the pinned comment", async () => {
    const store = createPinStore([buildComment({ id: firstId, isPinned: true, pinnedAt })], { pinnedCommentId: firstId });
    expect(await createApplyContentVisibilityHandler(store.context)({ targetType: "comment", targetId: firstId, visibility: "hidden", occurredAt: pinnedAt })).toBe(true);
    expect(store.comments[0]).toMatchObject({ isPinned: false, moderationVisibility: "hidden" });
    expect(store.posts[0]?.["pinnedCommentId"]).toBeNull();
  });

  it("keeps the pin when moderation only restricts the comment", async () => {
    const store = createPinStore([buildComment({ id: firstId, isPinned: true, pinnedAt })], { pinnedCommentId: firstId });
    await createApplyContentVisibilityHandler(store.context)({ targetType: "comment", targetId: firstId, visibility: "restricted", occurredAt: pinnedAt });
    expect(store.comments[0]?.["isPinned"]).toBe(true);
    expect(store.posts[0]?.["pinnedCommentId"]).toBe(firstId);
  });
});
