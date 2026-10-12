import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { dispatchMockApiRequest } from "@/mocks/dispatch.mock";
import { mockPostsState } from "@/mocks/postCatalog.mock";
import type { Comment, CommentHiddenState, CommentWithReplies, MyPostComment, Page } from "@/types";

import { validateAgainstContract } from "./contractSchema.util";
import { webappContracts } from "./webapp.contract";

const encode = (value: unknown) => new TextEncoder().encode(JSON.stringify(value));
const call = <T>(method: string, path: string, body?: unknown, query = "") => dispatchMockApiRequest(method, path, new URLSearchParams(query), body === undefined ? null : encode(body)) as Promise<T>;
const failureOf = (request: Promise<unknown>) => request.then(() => undefined, (error: unknown) => error as { status: number; code?: string });
const hiddenListContract = webappContracts.find((contract) => contract.path.startsWith("/api/v1/me/post-comments"))!;

describe("comment hiding mocks", () => {
  it("hides a comment and its replies from the post, lists it as hidden and restores it on unhide", async () => {
    const listed = await call<Page<CommentWithReplies>>("GET", "/api/v1/posts/post_9/comments");
    const target = listed.data.find((comment) => comment.replyCount > 0)!;
    const countBefore = mockPostsState.get("post_9")!.comments;
    const hidden = await call<CommentHiddenState>("PUT", `/api/v1/posts/post_9/comments/${target.id}/hide`);
    assert.equal(hidden.hidden, true);
    assert.deepEqual(await call<CommentHiddenState>("PUT", `/api/v1/posts/post_9/comments/${target.id}/hide`), hidden);
    const after = await call<Page<CommentWithReplies>>("GET", "/api/v1/posts/post_9/comments");
    assert.ok(!after.data.some((comment) => comment.id === target.id));
    assert.ok(mockPostsState.get("post_9")!.comments < countBefore);
    const inbox = await call<Page<MyPostComment>>("GET", "/api/v1/me/post-comments", undefined, "filter=hidden");
    assert.equal(inbox.data[0]?.id, target.id);
    assert.deepEqual(validateAgainstContract(hiddenListContract.schema, inbox), []);
    const restored = await call<CommentHiddenState>("DELETE", `/api/v1/posts/post_9/comments/${target.id}/hide`);
    assert.equal(restored.hidden, false);
    assert.equal(mockPostsState.get("post_9")!.comments, countBefore);
    assert.equal((await call<Page<MyPostComment>>("GET", "/api/v1/me/post-comments", undefined, "filter=hidden")).data.length, 0);
  });

  it("refuses hiding on someone else's post and hiding your own comment", async () => {
    const comment = await call<Comment>("POST", "/api/v1/posts/post_1/comments", { text: "hello" });
    assert.equal((await failureOf(call("PUT", `/api/v1/posts/post_1/comments/${comment.id}/hide`)))?.status, 403);
    const own = await call<Comment>("POST", "/api/v1/posts/post_9/comments", { text: "mine" });
    assert.equal((await failureOf(call("PUT", `/api/v1/posts/post_9/comments/${own.id}/hide`)))?.code, "COMMENT_NOT_HIDEABLE");
    assert.equal((await failureOf(call("DELETE", "/api/v1/posts/post_9/comments/cm_missing/hide")))?.status, 404);
  });
});
