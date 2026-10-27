import { describe, expect, it } from "vitest";

import { markMutedPostNotifications } from "../../src/events/postNotificationMutes.event.js";
import { createCreateCommentHandler } from "../../src/modules/comments/commands/createComment/createComment.handler.js";
import { createDeleteCommentHandler } from "../../src/modules/comments/commands/deleteComment/deleteComment.handler.js";
import { createSetPostNotificationMuteHandler } from "../../src/modules/posts/commands/setPostNotificationMute/setPostNotificationMute.handler.js";
import { createGetPostHandler } from "../../src/modules/posts/queries/getPost/getPost.handler.js";
import { createGetPostNotificationMuteHandler } from "../../src/modules/posts/queries/getPostNotificationMute/getPostNotificationMute.handler.js";
import type { Db } from "../../src/types/database.type.js";
import { createMemoryStore, type Row } from "../comments/memoryDb.fake.js";
import { buildComment } from "../comments/pinStore.fake.js";
import { authorId, buildPostRow, viewerId } from "./socialPostFakes.fake.js";

const postId = "0192f0a0-0000-7000-8000-0000000000f1";
const quotedId = "0192f0a0-0000-7000-8000-0000000000f2";
const otherUser = "0192f0a0-0000-7000-8000-00000000c0ff";

function setup() {
  const store = createMemoryStore({
    posts: [{ ...buildPostRow({ id: postId, authorId }) } as Row, { ...buildPostRow({ id: quotedId, authorId: otherUser, text: "Quoted" }) } as Row],
    postDefaults: () => ({ ...buildPostRow({}), id: undefined }),
    commentDefaults: () => buildComment({ id: "" }),
  });
  return store;
}

const payloads = (store: ReturnType<typeof setup>, type: string) => store.events.map((event) => event["payload"] as Row).filter((payload) => payload["type"] === type).map((payload) => payload["data"] as Row);

describe("per-post notification mutes", () => {
  it("marks every post-scoped notification for a muted recipient and nobody else", async () => {
    const store = setup();
    await createSetPostNotificationMuteHandler(store.context)({ actorId: authorId, postId, muted: true });
    await createCreateCommentHandler(store.context)({ authorId: viewerId, postId, text: "hello", parentCommentId: undefined, mentions: undefined });
    expect(payloads(store, "comment.created")).toEqual([expect.objectContaining({ recipientUserId: authorId, notificationsMuted: true })]);
    const events = await markMutedPostNotifications(store.context.database.client as Db, [
      { eventType: "comment.created", data: { recipientUserId: otherUser, postId } },
      { eventType: "post.liked", data: { postAuthorId: authorId, postId } },
      { eventType: "comment.pinned", data: { commentAuthorId: authorId, postId } },
      { eventType: "post.reshared", data: { originalAuthorId: authorId, originalPostId: postId } },
      { eventType: "videoReply.created", data: { recipientUserId: authorId, originalClipId: postId } },
      { eventType: "message.sent", data: { recipientIds: [authorId], postId } },
      { eventType: "account.passwordChanged", data: { recipientUserId: authorId, postId } },
    ]);
    expect(events.map((event) => (event.data as Row)["notificationsMuted"] === true)).toEqual([false, true, true, true, true, false, false]);
  });

  it("stops marking after unmute, and toggling twice is harmless", async () => {
    const store = setup();
    const setMute = createSetPostNotificationMuteHandler(store.context);
    const getMute = createGetPostNotificationMuteHandler(store.context);
    await setMute({ actorId: authorId, postId, muted: true });
    await setMute({ actorId: authorId, postId, muted: true });
    expect(store.postMutes).toHaveLength(1);
    expect(await getMute({ viewerId: authorId, postId })).toEqual({ postId, muted: true });
    expect((await createGetPostHandler(store.context)({ viewerId: authorId, postId })).viewerNotificationsMuted).toBe(true);
    expect((await createGetPostHandler(store.context)({ viewerId: otherUser, postId })).viewerNotificationsMuted).toBe(false);
    await setMute({ actorId: authorId, postId, muted: false });
    await setMute({ actorId: authorId, postId, muted: false });
    expect(await getMute({ viewerId: authorId, postId })).toEqual({ postId, muted: false });
    await createCreateCommentHandler(store.context)({ authorId: viewerId, postId, text: "hi", parentCommentId: undefined, mentions: undefined });
    expect(payloads(store, "comment.created")[0]?.["notificationsMuted"]).toBeUndefined();
  });

  it("refuses to mute a post the viewer can't see", async () => {
    const store = setup();
    store.blocks.push({ blockerId: authorId, blockedId: viewerId });
    await expect(createSetPostNotificationMuteHandler(store.context)({ actorId: viewerId, postId, muted: true })).rejects.toMatchObject({ status: 404 });
  });
});

describe("quotes inside comments", () => {
  it("counts the quote, notifies the quoted author and undoes the count on delete", async () => {
    const store = setup();
    const quoted = () => store.posts.find((row) => row["id"] === quotedId) as Row;
    const comment = await createCreateCommentHandler(store.context)({ authorId: viewerId, postId, text: `see https://nantty.com/post/${quotedId}`, parentCommentId: undefined, mentions: undefined });
    expect(quoted()).toMatchObject({ quoteCount: 1, repostCount: 0 });
    expect(payloads(store, "post.reshared")).toEqual([expect.objectContaining({ originalAuthorId: otherUser, originalPostId: quotedId, surface: "comment", commentId: comment.id, isQuote: true, url: `/post/${postId}?comment=${comment.id}` })]);
    await createDeleteCommentHandler(store.context)({ actorId: viewerId, commentId: comment.id });
    expect(quoted()["quoteCount"]).toBe(0);
    await createDeleteCommentHandler(store.context)({ actorId: viewerId, commentId: comment.id }).catch(() => undefined);
    expect(quoted()["quoteCount"]).toBe(0);
  });

  it("marks the quote notification muted when the quoted author muted their post", async () => {
    const store = setup();
    await createSetPostNotificationMuteHandler(store.context)({ actorId: otherUser, postId: quotedId, muted: true });
    await createCreateCommentHandler(store.context)({ authorId: viewerId, postId, text: `https://nantty.com/post/${quotedId}`, parentCommentId: undefined, mentions: undefined });
    expect(payloads(store, "post.reshared")[0]?.["notificationsMuted"]).toBe(true);
  });
});
