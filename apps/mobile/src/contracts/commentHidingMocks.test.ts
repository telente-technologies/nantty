import { resolveMockApiRequest } from "@/mocks";
import type { Comment, CommentHiddenState, CommentWithReplies, MyPostComment, Page, Post } from "@/types";

import { c, validateAgainstContract } from "./contractSchema.util";

const hiddenState = c.object({ commentId: c.string(), postId: c.string(), hidden: c.boolean(), hiddenAt: c.nullable(c.string()) });
const hiddenItem = c.object({
  id: c.string(), postId: c.string(), parentCommentId: c.nullable(c.string()), text: c.string(), replyCount: c.number(),
  post: c.object({ id: c.string(), kind: c.string(), text: c.string(), thumbnailUrl: c.nullable(c.string()) }), hidden: c.boolean(), hiddenAt: c.nullable(c.string()), needsReply: c.boolean(),
});
const createPost = (text: string) => resolveMockApiRequest<Post>("POST", "/api/v1/posts", { text, mediaIds: [], audience: "everyone", kind: "post" });
const failureOf = (request: Promise<unknown>) => request.then(() => undefined, (error: unknown) => error);

describe("comment hiding mocks", () => {
  jest.setTimeout(30_000);

  it("hides another person's comment with its replies, lists it under hidden comments and restores it", async () => {
    const post = await createPost("hide a comment");
    const listed = await resolveMockApiRequest<Page<CommentWithReplies>>("GET", `/api/v1/posts/${post.id}/comments`, undefined);
    const target = listed.data.find((comment) => comment.replyCount > 0) as CommentWithReplies;
    const hidden = await resolveMockApiRequest<CommentHiddenState>("PUT", `/api/v1/posts/${post.id}/comments/${target.id}/hide`, undefined);
    expect(validateAgainstContract(hiddenState, hidden)).toEqual([]);
    expect(hidden.hidden).toBe(true);
    expect(await resolveMockApiRequest<CommentHiddenState>("PUT", `/api/v1/posts/${post.id}/comments/${target.id}/hide`, undefined)).toEqual(hidden);
    const after = await resolveMockApiRequest<Page<CommentWithReplies>>("GET", `/api/v1/posts/${post.id}/comments`, undefined);
    expect(after.data.some((comment) => comment.id === target.id)).toBe(false);
    const inbox = await resolveMockApiRequest<Page<MyPostComment>>("GET", "/api/v1/me/post-comments?filter=hidden", undefined);
    expect(inbox.data.map((comment) => comment.id)).toContain(target.id);
    for (const item of inbox.data) expect(validateAgainstContract(hiddenItem, item)).toEqual([]);
    const restored = await resolveMockApiRequest<CommentHiddenState>("DELETE", `/api/v1/posts/${post.id}/comments/${target.id}/hide`, undefined);
    expect(restored.hidden).toBe(false);
    const back = await resolveMockApiRequest<Page<CommentWithReplies>>("GET", `/api/v1/posts/${post.id}/comments`, undefined);
    expect(back.data.length + (back.nextCursor ? 1 : 0)).toBeGreaterThan(0);
  });

  it("refuses hiding on someone else's post and hiding your own comment", async () => {
    const own = await createPost("mine");
    const mine = await resolveMockApiRequest<Comment>("POST", `/api/v1/posts/${own.id}/comments`, { text: "my comment" });
    expect(await failureOf(resolveMockApiRequest("PUT", `/api/v1/posts/${own.id}/comments/${mine.id}/hide`, undefined))).toMatchObject({ status: 422, code: "COMMENT_NOT_HIDEABLE" });
    const others = await resolveMockApiRequest<Page<CommentWithReplies>>("GET", "/api/v1/posts/post_1/comments", undefined);
    const someone = others.data[0] as CommentWithReplies;
    expect(await failureOf(resolveMockApiRequest("PUT", `/api/v1/posts/post_1/comments/${someone.id}/hide`, undefined))).toMatchObject({ status: 403 });
  });
});
