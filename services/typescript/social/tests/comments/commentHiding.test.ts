import { describe, expect, it } from "vitest";

import { createCreateCommentHandler } from "../../src/modules/comments/commands/createComment/createComment.handler.js";
import { createDeleteCommentHandler } from "../../src/modules/comments/commands/deleteComment/deleteComment.handler.js";
import { createHideCommentHandler } from "../../src/modules/comments/commands/hideComment/hideComment.handler.js";
import { createUnhideCommentHandler } from "../../src/modules/comments/commands/unhideComment/unhideComment.handler.js";
import { createGetCommentHandler } from "../../src/modules/comments/queries/getComment/getComment.handler.js";
import { createGetCommentThreadHandler } from "../../src/modules/comments/queries/getCommentThread/getCommentThread.handler.js";
import { createGetPostConversationHandler } from "../../src/modules/comments/queries/getPostConversation/getPostConversation.handler.js";
import { createListPostCommentsHandler } from "../../src/modules/comments/queries/listPostComments/listPostComments.handler.js";
import { authorId, buildPostRow } from "../posts/socialPostFakes.fake.js";
import { createMemoryStore, type Row } from "./memoryDb.fake.js";
import { buildComment } from "./pinStore.fake.js";

const postId = "0192f0a0-0000-7000-8000-0000000000a1";
const commenter = "0192f0a0-0000-7000-8000-00000000c001";
const stranger = "0192f0a0-0000-7000-8000-00000000c002";
const replier = "0192f0a0-0000-7000-8000-00000000c003";
const rootId = "0192f0a0-0000-7000-8000-0000000000d1";
const replyId = "0192f0a0-0000-7000-8000-0000000000d2";
const childId = "0192f0a0-0000-7000-8000-0000000000d3";
const otherRootId = "0192f0a0-0000-7000-8000-0000000000d4";

function setup() {
  const store = createMemoryStore({
    posts: [{ ...buildPostRow({ id: postId, authorId, commentCount: 4 }) } as Row],
    comments: [
      buildComment({ id: rootId, postId, authorId: commenter, replyCount: 1 }),
      buildComment({ id: replyId, postId, authorId: replier, parentCommentId: rootId, rootCommentId: rootId, depth: 1, path: rootId, replyCount: 1 }),
      buildComment({ id: childId, postId, authorId: commenter, parentCommentId: replyId, rootCommentId: rootId, depth: 2, path: `${rootId}/${replyId}` }),
      buildComment({ id: otherRootId, postId, authorId: stranger }),
    ],
  });
  return {
    store,
    hide: createHideCommentHandler(store.context),
    unhide: createUnhideCommentHandler(store.context),
    remove: createDeleteCommentHandler(store.context),
    getComment: createGetCommentHandler(store.context),
    thread: createGetCommentThreadHandler(store.context),
    list: createListPostCommentsHandler(store.context),
    conversation: createGetPostConversationHandler(store.context),
  };
}

const row = (rows: Row[], id: string) => rows.find((entry) => entry["id"] === id) as Row;
const postCount = (store: ReturnType<typeof setup>["store"]) => row(store.posts, postId)["commentCount"];
const eventsOf = (store: ReturnType<typeof setup>["store"], type: string) => store.events.filter((event) => event["eventType"] === type);
const listIds = async (list: ReturnType<typeof setup>["list"], viewerId: string | undefined) => (await list({ viewerId, postId, cursor: undefined, limit: 20 })).data.map((item) => item.id);

describe("hiding comments", () => {
  it("lets the post author hide and unhide, moving the public counts and emitting events", async () => {
    const { store, hide, unhide } = setup();
    await expect(hide({ actorId: authorId, postId, commentId: rootId })).resolves.toMatchObject({ commentId: rootId, hidden: true });
    expect(row(store.comments, rootId)).toMatchObject({ hiddenByUserId: authorId });
    expect(postCount(store)).toBe(1);
    await expect(unhide({ actorId: authorId, postId, commentId: rootId })).resolves.toMatchObject({ hidden: false, hiddenAt: null });
    expect(postCount(store)).toBe(4);
    expect(eventsOf(store, "comment.hidden")).toHaveLength(1);
    expect(eventsOf(store, "comment.unhidden")).toHaveLength(1);
  });

  it("refuses anyone but the post author, and the author's own comments", async () => {
    const { store, hide, unhide } = setup();
    await expect(hide({ actorId: stranger, postId, commentId: rootId })).rejects.toMatchObject({ status: 403 });
    await expect(hide({ actorId: commenter, postId, commentId: rootId })).rejects.toMatchObject({ status: 403 });
    await expect(unhide({ actorId: stranger, postId, commentId: rootId })).rejects.toMatchObject({ status: 403 });
    store.comments.push(buildComment({ id: "0192f0a0-0000-7000-8000-0000000000d9", postId, authorId }));
    await expect(hide({ actorId: authorId, postId, commentId: "0192f0a0-0000-7000-8000-0000000000d9" })).rejects.toMatchObject({ status: 422 });
    await expect(hide({ actorId: authorId, postId: "0192f0a0-0000-7000-8000-0000000000ff", commentId: rootId })).rejects.toMatchObject({ status: 404 });
    expect(row(store.comments, rootId)["hiddenAt"]).toBeNull();
  });

  it("hides the comment from everyone but its commenter, who still sees it everywhere", async () => {
    const { hide, list, conversation, getComment } = setup();
    await hide({ actorId: authorId, postId, commentId: rootId });
    expect(await listIds(list, stranger)).toEqual([otherRootId]);
    expect(await listIds(list, undefined)).toEqual([otherRootId]);
    expect(await listIds(list, authorId)).toEqual([otherRootId]);
    expect((await listIds(list, commenter)).sort()).toEqual([rootId, otherRootId].sort());
    const latest = await conversation({ viewerId: stranger, postId, sort: "latest", filter: undefined, cursor: undefined, limit: 20 });
    expect(latest.data.map((item) => item.id)).toEqual([otherRootId]);
    await expect(getComment({ viewerId: stranger, commentId: rootId })).rejects.toMatchObject({ status: 404 });
    await expect(getComment({ viewerId: commenter, commentId: rootId })).resolves.toMatchObject({ id: rootId });
    await expect(getComment({ viewerId: replier, commentId: replyId })).rejects.toMatchObject({ status: 404 });
  });

  it("is idempotent and race safe when hidden twice at once", async () => {
    const { store, hide, unhide } = setup();
    const [first, second] = await Promise.all([hide({ actorId: authorId, postId, commentId: rootId }), hide({ actorId: authorId, postId, commentId: rootId })]);
    expect(first.hidden && second.hidden).toBe(true);
    expect(first.hiddenAt).toBe(second.hiddenAt);
    expect(postCount(store)).toBe(1);
    expect(eventsOf(store, "comment.hidden")).toHaveLength(1);
    await Promise.all([unhide({ actorId: authorId, postId, commentId: rootId }), unhide({ actorId: authorId, postId, commentId: rootId })]);
    expect(postCount(store)).toBe(4);
    expect(eventsOf(store, "comment.unhidden")).toHaveLength(1);
  });

  it("hides a reply in a chain and the replies under it", async () => {
    const { store, hide, thread, getComment } = setup();
    await hide({ actorId: authorId, postId, commentId: replyId });
    expect(row(store.comments, rootId)["replyCount"]).toBe(0);
    expect(postCount(store)).toBe(2);
    const forStranger = await thread({ viewerId: stranger, commentId: rootId, cursor: undefined, limit: 10 });
    expect(forStranger.data).toEqual([]);
    const forReplier = await thread({ viewerId: replier, commentId: rootId, cursor: undefined, limit: 10 });
    expect(forReplier.data.map((item) => item.id)).toEqual([replyId]);
    expect(forReplier.data[0]?.inlineReplies.map((item) => item.id)).toEqual([childId]);
    await expect(getComment({ viewerId: commenter, commentId: childId })).rejects.toMatchObject({ status: 404 });
    await expect(getComment({ viewerId: replier, commentId: childId })).resolves.toMatchObject({ id: childId });
    await hide({ actorId: authorId, postId, commentId: rootId });
    expect(postCount(store)).toBe(1);
    await hide({ actorId: authorId, postId, commentId: childId });
    expect(postCount(store)).toBe(1);
  });

  it("does not double count when a hidden comment is deleted, and will not unhide a deleted one", async () => {
    const { store, hide, unhide, remove } = setup();
    await hide({ actorId: authorId, postId, commentId: replyId });
    await remove({ actorId: authorId, commentId: replyId });
    expect(postCount(store)).toBe(2);
    expect(row(store.comments, rootId)["replyCount"]).toBe(0);
    await expect(unhide({ actorId: authorId, postId, commentId: replyId })).rejects.toMatchObject({ status: 404 });
    await remove({ actorId: commenter, commentId: rootId });
    expect(postCount(store)).toBe(1);
  });

  it("lets the commenter delete their hidden comment while strangers cannot touch it", async () => {
    const { store, hide, remove } = setup();
    await hide({ actorId: authorId, postId, commentId: otherRootId });
    await expect(remove({ actorId: commenter, commentId: otherRootId })).rejects.toMatchObject({ status: 403 });
    await remove({ actorId: stranger, commentId: otherRootId });
    expect(row(store.comments, otherRootId)["deletedAt"]).not.toBeNull();
    expect(postCount(store)).toBe(3);
  });

  it("keeps a reply under a hidden comment out of counts and notifications", async () => {
    const { store, hide } = setup();
    await hide({ actorId: authorId, postId, commentId: rootId });
    const create = createCreateCommentHandler(store.context);
    const before = store.events.length;
    await create({ authorId: commenter, postId, text: "still here", parentCommentId: rootId, mentions: undefined, quotedPostId: undefined });
    expect(postCount(store)).toBe(1);
    expect(store.events.slice(before).filter((event) => event["eventType"] === "comment.created")).toHaveLength(0);
    await expect(create({ authorId: stranger, postId, text: "hi", parentCommentId: rootId, mentions: undefined, quotedPostId: undefined })).rejects.toMatchObject({ status: 404 });
  });

  it("links comments on clips back to that clip and exact comment", async () => {
    const store = createMemoryStore({ posts: [{ ...buildPostRow({ id: postId, kind: "clip", commentCount: 0 }) } as Row] });
    await createCreateCommentHandler(store.context)({ authorId: commenter, postId, text: "Nice clip", parentCommentId: undefined, mentions: undefined, quotedPostId: undefined });
    const notificationEvent = store.events.find((event) => event["eventType"] === "comment.created");
    const eventPayload = notificationEvent?.["payload"] as Record<string, unknown> | undefined;
    const eventData = eventPayload?.["data"] as Record<string, unknown> | undefined;
    expect(eventData?.["url"]).toBe(`/clips/${postId}?comment=${String(eventData?.["commentId"])}`);
  });

  it("stores a managed profile as the visible comment identity and rejects profiles owned by someone else", async () => {
    const store = createMemoryStore({ posts: [{ ...buildPostRow({ id: postId, commentCount: 0 }) } as Row] });
    const profileId = "0192f0a0-0000-7000-8000-0000000000e1";
    const profile = { id: profileId, accountId: commenter, kind: "brand", displayName: "Nantty Studio", handle: "nantty-studio", avatarUrl: "https://cdn.example.test/brand.png" };
    store.context.directory.findOwnedPostableProfile = async (accountId, requestedId) => accountId === commenter && requestedId === profileId ? profile : null;
    store.context.directory.findProfilesByIds = async (ids) => new Map(ids.filter((id) => id === profileId).map((id) => [id, profile]));
    const create = createCreateCommentHandler(store.context);

    await expect(create({ authorId: stranger, authorProfileId: profileId, postId, text: "forged identity", parentCommentId: undefined, mentions: undefined, quotedPostId: undefined })).rejects.toMatchObject({ status: 404 });
    const created = await create({ authorId: commenter, authorProfileId: profileId, postId, text: "Hello as Nantty Studio", parentCommentId: undefined, mentions: undefined, quotedPostId: undefined });

    expect(store.comments).toContainEqual(expect.objectContaining({ authorId: commenter, authorProfileId: profileId }));
    expect(created).toMatchObject({ author: { id: commenter }, postedAs: { id: profileId, kind: "brand", name: "Nantty Studio", handle: "nantty-studio" } });
  });

  it("unpins a pinned comment when it is hidden", async () => {
    const { store, hide } = setup();
    row(store.comments, otherRootId)["isPinned"] = true;
    row(store.posts, postId)["pinnedCommentId"] = otherRootId;
    await hide({ actorId: authorId, postId, commentId: otherRootId });
    expect(row(store.comments, otherRootId)["isPinned"]).toBe(false);
    expect(row(store.posts, postId)["pinnedCommentId"]).toBeNull();
  });
});
