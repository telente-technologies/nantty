import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { dispatchMockApiRequest } from "@/mocks/dispatch.mock";
import { mockPostsState } from "@/mocks/postCatalog.mock";
import type { CommentWithReplies, Page, Post } from "@/types";
import { isQuoteThreadItem, type QuoteThreadItem, type ThreadReply } from "@/types/postThread.type";

const encode = (value: unknown) => new TextEncoder().encode(JSON.stringify(value));
const call = <T>(method: string, path: string, body?: unknown, query: Record<string, string> = {}) =>
  dispatchMockApiRequest(method, path, new URLSearchParams(query), body === undefined ? null : encode(body)) as Promise<T>;
const failureOf = (request: Promise<unknown>) => request.then(() => undefined, (error: unknown) => error as { status: number; code?: string });
const publish = (text: string, quotedPostId?: string | null) => call<Post>("POST", "/api/v1/posts", { text, mediaIds: [], audience: "everyone", kind: "post", ...(quotedPostId === undefined ? {} : { quotedPostId }) });
const quoteIdsIn = (items: readonly object[]) => items.filter(isQuoteThreadItem).map((item) => item.id);

describe("quotes in the comment section mocks", () => {
  it("lists button and link quotes in the original's comments and thread, and the Quotes filter", async () => {
    const original = await publish("original thought");
    const viaButton = await publish("my take", original.id);
    const viaLink = await publish(`hot take https://app.zudomart.com/post/${original.id}`);
    assert.equal(viaLink.text, "hot take");
    assert.equal(viaLink.resharedFrom?.id, original.id);
    const comments = await call<Page<CommentWithReplies | QuoteThreadItem>>("GET", `/api/v1/posts/${original.id}/comments`);
    assert.deepEqual(quoteIdsIn(comments.data).sort(), [viaButton.id, viaLink.id].sort());
    const thread = await call<Page<ThreadReply | QuoteThreadItem>>("GET", `/api/v1/posts/${original.id}/thread`, undefined, { sort: "relevant" });
    assert.equal(quoteIdsIn(thread.data).length, 2);
    const onlyQuotes = await call<Page<QuoteThreadItem>>("GET", `/api/v1/posts/${original.id}/thread`, undefined, { filter: "quotes" });
    assert.ok(onlyQuotes.data.every((item) => item.type === "quote" && item.postId === original.id && typeof item.quotePost.author.username === "string"));
  });

  it("shows the seeded quotes, opens them, and drops a deleted quote", async () => {
    const seeded = await call<Page<QuoteThreadItem>>("GET", "/api/v1/posts/post_3/comments", undefined, { filter: "quotes" });
    assert.ok(seeded.data.length >= 2);
    assert.equal((await call<Post>("GET", `/api/v1/posts/${seeded.data[0]!.id}`)).id, seeded.data[0]!.id);
    const original = await publish("short lived quote target");
    const quote = await publish("quoting", original.id);
    await call("DELETE", `/api/v1/posts/${quote.id}`);
    assert.deepEqual(quoteIdsIn((await call<Page<CommentWithReplies | QuoteThreadItem>>("GET", `/api/v1/posts/${original.id}/comments`)).data), []);
    assert.equal(mockPostsState.get(original.id)?.quotes, 0);
  });

  it("refuses a quote of a post deleted while composing, and repost/undo toggles once", async () => {
    const original = await publish("about to vanish");
    await call("DELETE", `/api/v1/posts/${original.id}`);
    assert.equal((await failureOf(publish("too late", original.id)))?.code, "QUOTED_POST_UNAVAILABLE");
    await call("POST", "/api/v1/posts/post_5/repost", {});
    await call("POST", "/api/v1/posts/post_5/repost", {});
    const reposted = mockPostsState.get("post_5");
    assert.equal(reposted?.reposted, true);
    await call("DELETE", "/api/v1/posts/post_5/repost");
    await call("DELETE", "/api/v1/posts/post_5/repost");
    assert.equal(mockPostsState.get("post_5")?.reposted, false);
    assert.equal(mockPostsState.get("post_5")?.reposts, (reposted?.reposts ?? 1) - 1);
  });
});
