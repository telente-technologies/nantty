import { describe, expect, it } from "vitest";

import { createCreateCommentHandler } from "../../src/modules/comments/commands/createComment/createComment.handler.js";
import { buildCommentViews } from "../../src/modules/comments/services/commentView.service.js";
import type { CommentRow } from "../../src/modules/comments/repositories/comment.repository.js";
import { createCreatePostHandler } from "../../src/modules/posts/commands/createPost/createPost.handler.js";
import { createResharePostHandler } from "../../src/modules/posts/commands/resharePost/resharePost.handler.js";
import type { CreatePostCommand } from "../../src/modules/posts/commands/createPost/createPost.command.js";
import { createMemoryStore, type Row } from "../comments/memoryDb.fake.js";
import { buildComment } from "../comments/pinStore.fake.js";
import { authorId, buildPostRow, viewerId } from "./socialPostFakes.fake.js";

const targetId = "0192f0a0-0000-7000-8000-0000000000d1";
const secondTargetId = "0192f0a0-0000-7000-8000-0000000000d2";
const quoteOfTargetId = "0192f0a0-0000-7000-8000-0000000000d3";
const commentedPostId = "0192f0a0-0000-7000-8000-0000000000d4";
const link = (id: string, host = "app.nantty.com") => `https://${host}/post/${id}`;

function setup(extraPosts: Row[] = []) {
  const store = createMemoryStore({
    posts: [
      { ...buildPostRow({ id: targetId, authorId, text: "Original", media: [] }) } as Row,
      { ...buildPostRow({ id: secondTargetId, authorId, text: "Second" }) } as Row,
      { ...buildPostRow({ id: commentedPostId, authorId: viewerId, text: "Mine" }) } as Row,
      ...extraPosts,
    ],
    postDefaults: () => ({ ...buildPostRow({}), id: undefined }),
    commentDefaults: () => buildComment({ id: "" }),
  });
  const createPost = createCreatePostHandler(store.context);
  const post = (text: string, extra: Partial<CreatePostCommand> = {}) =>
    createPost({ authorId: viewerId, kind: "post", text, mediaIds: [], audience: "everyone", visibility: "public", isAiGenerated: false, soundId: undefined, mentions: undefined, replyToComment: undefined, stickerLayout: undefined, ...extra });
  const comment = (text: string, quotedPostId?: string | null) => createCreateCommentHandler(store.context)({ authorId: viewerId, postId: commentedPostId, text, parentCommentId: undefined, mentions: undefined, quotedPostId });
  const target = () => store.posts.find((row) => row["id"] === targetId) as Row;
  return { store, post, comment, target };
}

describe("repost by link", () => {
  it("persists the selected followers audience on the created post", async () => {
    const { store, post } = setup();
    await post("Followers only", { audience: "followers" });
    expect(store.posts.at(-1)).toMatchObject({ audience: "followers" });
  });

  it("turns a trailing post link into a quote, strips it and bumps counters", async () => {
    const { store, post, target } = setup();
    const view = await post(`So true ${link(targetId)}`);
    expect(view).toMatchObject({ text: "So true", isQuote: true, resharedFrom: { id: targetId, text: "Original" }, resharedFromUnavailable: false });
    expect(target()).toMatchObject({ quoteCount: 1, repostCount: 1 });
    expect(store.events.map((event) => (event["payload"] as Row)["type"])).toEqual(expect.arrayContaining(["post.created", "post.reshared"]));
  });

  it("keeps a link in the middle of the text but still quotes it", async () => {
    const { post } = setup();
    const view = await post(`Look ${link(targetId, "www.nantty.com")} right?`);
    expect(view.text).toBe(`Look ${link(targetId, "www.nantty.com")} right?`);
    expect(view.resharedFrom?.id).toBe(targetId);
  });

  it.each([
    ["a foreign domain", link(targetId, "evil.io")],
    ["a lookalike domain", link(targetId, "nantty.com.evil.io")],
    ["a malformed id", "https://nantty.com/post/abc123"],
    ["a link to a comment", `${link(targetId)}?comment=${secondTargetId}`],
  ])("leaves %s as plain text", async (_label, url) => {
    const { post, target } = setup();
    const view = await post(`check ${url}`);
    expect(view).toMatchObject({ text: `check ${url}`, isQuote: false, resharedFrom: null });
    expect(target()["quoteCount"]).toBe(0);
  });

  it("leaves a deleted, blocked or private target as plain text", async () => {
    const deleted = setup();
    deleted.target()["deletedAt"] = new Date("2026-10-09T00:00:00Z");
    expect((await deleted.post(link(targetId))).isQuote).toBe(false);

    const blocked = setup();
    blocked.store.blocks.push({ blockerId: authorId, blockedId: viewerId });
    expect((await blocked.post(link(targetId))).resharedFrom).toBeNull();

    const privateAccount = setup();
    privateAccount.store.privateAccountIds.add(authorId);
    const view = await privateAccount.post(link(targetId));
    expect(view).toMatchObject({ isQuote: false, text: link(targetId) });
  });

  it("only uses the first post link", async () => {
    const { post } = setup();
    const view = await post(`${link(secondTargetId)} and ${link(targetId)}`);
    expect(view.resharedFrom?.id).toBe(secondTargetId);
  });

  it("does not try the second link when the first one is unavailable", async () => {
    const { store, post } = setup();
    (store.posts.find((row) => row["id"] === secondTargetId) as Row)["deletedAt"] = new Date();
    expect((await post(`${link(secondTargetId)} ${link(targetId)}`)).isQuote).toBe(false);
  });

  it("validates an explicit quotedPostId and never trusts it blindly", async () => {
    const { store, post } = setup();
    store.privateAccountIds.add(authorId);
    await expect(post("hidden", { quotedPostId: targetId })).rejects.toMatchObject({ status: 422, code: "QUOTED_POST_UNAVAILABLE" });
    await expect(post("missing", { quotedPostId: "0192f0a0-0000-7000-8000-0000000000ff" })).rejects.toMatchObject({ code: "QUOTED_POST_UNAVAILABLE" });
  });

  it("honours an explicit null so a removed preview stays plain text", async () => {
    const { post } = setup();
    const view = await post(`keep ${link(targetId)}`, { quotedPostId: null });
    expect(view).toMatchObject({ isQuote: false, text: `keep ${link(targetId)}` });
  });

  it("embeds a quoted quote one level deep only", async () => {
    const { post } = setup([{ ...buildPostRow({ id: quoteOfTargetId, authorId, text: "Quote", resharedFromId: targetId, isQuote: true }) } as Row]);
    const view = await post(link(quoteOfTargetId));
    expect(view.resharedFrom).toMatchObject({ id: quoteOfTargetId, resharedFrom: null, resharedFromUnavailable: false });
  });

  it("refuses to quote a story through a link or a reshare", async () => {
    const story = "0192f0a0-0000-7000-8000-0000000000d5";
    const { store, post } = setup([{ ...buildPostRow({ id: story, authorId, kind: "story" }) } as Row]);
    expect((await post(link(story))).isQuote).toBe(false);
    await expect(createResharePostHandler(store.context)({ actorId: viewerId, postId: story, text: "" })).rejects.toMatchObject({ code: "STORY_CANNOT_BE_RESHARED" });
  });
});

describe("quote links in comments", () => {
  it("stores quotedPostId and returns an embedded summary", async () => {
    const { comment, target } = setup();
    const view = await comment(`agree ${link(targetId)}`);
    expect(view).toMatchObject({ text: "agree", quotedPostUnavailable: false, quotedPost: { id: targetId, text: "Original", author: { id: authorId }, thumbnail: null } });
    expect(target()).toMatchObject({ quoteCount: 1, repostCount: 0 });
  });

  it("allows a comment that is only a link", async () => {
    const { comment } = setup();
    expect(await comment(link(targetId))).toMatchObject({ text: "", quotedPost: { id: targetId } });
  });

  it("reports the quote as unavailable once the viewer is blocked", async () => {
    const { store, comment } = setup();
    const created = await comment(link(targetId));
    store.blocks.push({ blockerId: authorId, blockedId: viewerId });
    const row = store.comments.find((candidate) => candidate["id"] === created.id) as unknown as CommentRow;
    const [view] = await buildCommentViews(store.context, viewerId, [row]);
    expect(view).toMatchObject({ quotedPost: null, quotedPostUnavailable: true });
  });

  it("rejects an explicit quotedPostId it can't validate", async () => {
    const { comment } = setup();
    await expect(comment("hi", "0192f0a0-0000-7000-8000-0000000000ff")).rejects.toMatchObject({ code: "QUOTED_POST_UNAVAILABLE" });
  });
});
