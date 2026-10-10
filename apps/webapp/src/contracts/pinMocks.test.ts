import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { dispatchMockApiRequest } from "@/mocks/dispatch.mock";
import { mockPostsState } from "@/mocks/postCatalog.mock";
import type { Comment, CommentWithReplies, Page, Post } from "@/types";

const encode = (value: unknown) => new TextEncoder().encode(JSON.stringify(value));
const call = <T>(method: string, path: string, body?: unknown) => dispatchMockApiRequest(method, path, new URLSearchParams(), body === undefined ? null : encode(body)) as Promise<T>;
const failureOf = (request: Promise<unknown>) => request.then(() => undefined, (error: unknown) => error as { status: number; code?: string });
const isPinView = (value: { isPinned?: unknown; pinnedAt?: unknown }) => typeof value.isPinned === "boolean" && (value.pinnedAt === null || typeof value.pinnedAt === "string");

describe("pin mocks", () => {
  it("pins one top-level comment on an own post, lists it first and points the post at it", async () => {
    const first = await call<Comment>("POST", "/api/v1/posts/post_9/comments", { text: "first" });
    const second = await call<Comment>("POST", "/api/v1/posts/post_9/comments", { text: "second" });
    const reply = await call<Comment>("POST", "/api/v1/posts/post_9/comments", { text: "reply", parentCommentId: first.id });
    assert.ok(isPinView(await call<Comment>("PUT", `/api/v1/posts/post_9/comments/${first.id}/pin`)));
    await call("PUT", `/api/v1/posts/post_9/comments/${second.id}/pin`);
    const listed = await call<Page<CommentWithReplies>>("GET", "/api/v1/posts/post_9/comments");
    assert.equal(listed.data[0]?.id, second.id);
    assert.equal(listed.data.filter((comment) => comment.isPinned === true).length, 1);
    assert.equal(mockPostsState.get("post_9")?.pinnedCommentId, second.id);
    assert.equal((await failureOf(call("PUT", `/api/v1/posts/post_9/comments/${reply.id}/pin`)))?.code, "COMMENT_NOT_PINNABLE");
    await call("DELETE", `/api/v1/comments/${second.id}`);
    assert.equal(mockPostsState.get("post_9")?.pinnedCommentId, null);
  });

  it("refuses comment pins on someone else's post", async () => {
    const comment = await call<Comment>("POST", "/api/v1/posts/post_1/comments", { text: "hello" });
    assert.equal((await failureOf(call("PUT", `/api/v1/posts/post_1/comments/${comment.id}/pin`)))?.status, 403);
  });

  it("pins up to three own posts, most recently pinned first, then the rest", async () => {
    const own = mockPostsState.get("post_9") as Post;
    for (const id of ["pin_a", "pin_b"]) mockPostsState.set(id, { ...own, id, isPinned: false, pinnedAt: null });
    const ids = ["post_26", "pin_a", "pin_b"];
    for (const id of ids) {
      assert.ok(isPinView(await call<Post>("PUT", `/api/v1/posts/${id}/pin`)));
      await new Promise((resolve) => setTimeout(resolve, 5));
    }
    assert.equal((await failureOf(call("PUT", "/api/v1/posts/post_9/pin")))?.code, "PIN_LIMIT_REACHED");
    const profile = await call<Page<Post>>("GET", `/api/v1/users/${own.author.id}/posts`);
    assert.deepEqual(profile.data.slice(0, 3).map((post) => post.id), ["pin_b", "pin_a", "post_26"]);
    assert.equal(profile.data.slice(3).some((post) => post.isPinned === true), false);
    const unpinned = await call<Post>("DELETE", "/api/v1/posts/pin_a/pin");
    assert.equal(unpinned.isPinned, false);
    assert.equal((await failureOf(call("PUT", "/api/v1/posts/post_1/pin")))?.status, 403);
  });
});
