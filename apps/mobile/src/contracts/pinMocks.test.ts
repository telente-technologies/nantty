import { ApiError } from "@/errors/api.error";
import { resolveMockApiRequest } from "@/mocks";
import type { Comment, CommentWithReplies, Page, Post } from "@/types";

import { c, validateAgainstContract } from "./contractSchema.util";

const pinFields = c.object({ id: c.string(), isPinned: c.boolean(), pinnedAt: c.nullable(c.string()) });
const createPost = (text: string) => resolveMockApiRequest<Post>("POST", "/api/v1/posts", { text, mediaIds: [], audience: "everyone", kind: "post" });
const createComment = (postId: string, text: string, parentCommentId?: string) =>
  resolveMockApiRequest<Comment>("POST", `/api/v1/posts/${postId}/comments`, { text, ...(parentCommentId ? { parentCommentId } : {}) });
const failureOf = (request: Promise<unknown>) => request.then(() => undefined, (error: unknown) => error);

describe("pin mocks", () => {
  jest.setTimeout(30_000);

  it("pins one top-level comment per post, lists it first and points the post at it", async () => {
    const post = await createPost("pin a comment");
    const first = await createComment(post.id, "first");
    const second = await createComment(post.id, "second");
    const reply = await createComment(post.id, "reply", first.id);
    const pinnedFirst = await resolveMockApiRequest<Comment>("PUT", `/api/v1/posts/${post.id}/comments/${first.id}/pin`, undefined);
    expect(validateAgainstContract(pinFields, pinnedFirst)).toEqual([]);
    await resolveMockApiRequest("PUT", `/api/v1/posts/${post.id}/comments/${second.id}/pin`, undefined);
    const listed = await resolveMockApiRequest<Page<CommentWithReplies>>("GET", `/api/v1/posts/${post.id}/comments`, undefined);
    expect(listed.data[0]).toMatchObject({ id: second.id, isPinned: true });
    expect(listed.data.filter((comment) => comment.isPinned === true)).toHaveLength(1);
    expect((await resolveMockApiRequest<Post>("GET", `/api/v1/posts/${post.id}`, undefined)).pinnedCommentId).toBe(second.id);
    expect(await failureOf(resolveMockApiRequest("PUT", `/api/v1/posts/${post.id}/comments/${reply.id}/pin`, undefined))).toMatchObject({ status: 422, code: "COMMENT_NOT_PINNABLE" });
    await resolveMockApiRequest("DELETE", `/api/v1/comments/${second.id}`, undefined);
    expect((await resolveMockApiRequest<Post>("GET", `/api/v1/posts/${post.id}`, undefined)).pinnedCommentId ?? null).toBeNull();
  });

  it("refuses comment pins on someone else's post", async () => {
    const page = await resolveMockApiRequest<Page<CommentWithReplies>>("GET", "/api/v1/posts/post_1/comments", undefined);
    const target = page.data[0];
    if (!target) return;
    const failure = await failureOf(resolveMockApiRequest("PUT", `/api/v1/posts/post_1/comments/${target.id}/pin`, undefined));
    expect(failure).toBeInstanceOf(ApiError);
    expect(failure).toMatchObject({ status: 403 });
  });

  it("pins up to three own posts, most recently pinned first, then the rest", async () => {
    const posts = [await createPost("a"), await createPost("b"), await createPost("c"), await createPost("d")];
    for (const post of posts.slice(0, 3)) {
      expect(validateAgainstContract(pinFields, await resolveMockApiRequest<Post>("PUT", `/api/v1/posts/${post.id}/pin`, undefined))).toEqual([]);
    }
    expect(await failureOf(resolveMockApiRequest("PUT", `/api/v1/posts/${posts[3]!.id}/pin`, undefined))).toMatchObject({ status: 409, code: "PIN_LIMIT_REACHED" });
    const profile = await resolveMockApiRequest<Page<Post>>("GET", `/api/v1/users/${posts[0]!.author.id}/posts`, undefined);
    expect(profile.data.slice(0, 3).map((post) => post.id)).toEqual([posts[2]!.id, posts[1]!.id, posts[0]!.id]);
    expect(profile.data.slice(3).every((post) => post.isPinned !== true)).toBe(true);
    const unpinned = await resolveMockApiRequest<Post>("DELETE", `/api/v1/posts/${posts[1]!.id}/pin`, undefined);
    expect(unpinned).toMatchObject({ isPinned: false, pinnedAt: null });
    expect(await failureOf(resolveMockApiRequest("PUT", "/api/v1/posts/post_1/pin", undefined))).toMatchObject({ status: 403 });
  });
});
