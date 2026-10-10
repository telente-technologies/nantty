import { resolveMockApiRequest } from "@/mocks";
import type { Comment, CommentWithReplies, Page, Post } from "@/types";
import { countRepliesHiddenFromChain } from "@/utils/commentChain.util";
import { findFirstPostLinkInText, readPostIdFromLink } from "@/utils/postLinks.util";

import { c, validateAgainstContract } from "./contractSchema.util";

const quotedPostSummary = c.object({ id: c.string(), kind: c.string(["post", "clip"]), author: c.object({ id: c.string(), username: c.string() }), text: c.string(), mediaCount: c.number(), createdAt: c.string() });
const createPost = (text: string, quotedPostId?: string | null) =>
  resolveMockApiRequest<Post>("POST", "/api/v1/posts", { text, mediaIds: [], audience: "everyone", kind: "post", ...(quotedPostId === undefined ? {} : { quotedPostId }) });
const createComment = (postId: string, text: string, extra: Record<string, unknown> = {}) => resolveMockApiRequest<Comment>("POST", `/api/v1/posts/${postId}/comments`, { text, ...extra });
const failureOf = (request: Promise<unknown>) => request.then(() => undefined, (error: unknown) => error);

describe("post links", () => {
  it.each([
    ["https://app.zudomart.com/post/post_1", "post_1"],
    ["http://www.zudomart.com/clips/clip_9/", "clip_9"],
    ["https://zudomart.com.evil.io/post/post_1", null],
    ["https://evil.io/post/post_1", null],
    ["https://zudomart.com/post/post_1?comment=cm_1", null],
    ["https://zudomart.com/post/post_1/extra", null],
    ["https://zudomart.com:444/post/post_1", null],
  ])("reads %s as %s", (url, expected) => {
    expect(readPostIdFromLink(url)).toBe(expected);
  });

  it("uses only the first post link and drops trailing punctuation", () => {
    expect(findFirstPostLinkInText("see https://evil.io/x then https://zudomart.com/post/post_2. and https://zudomart.com/post/post_3")).toEqual({ postId: "post_2", url: "https://zudomart.com/post/post_2" });
  });
});

describe("quote link mocks", () => {
  jest.setTimeout(30_000);

  it("quotes a linked post, strips the trailing link and keeps a middle one", async () => {
    const trailing = await createPost("so true https://app.zudomart.com/post/post_1");
    expect(trailing).toMatchObject({ text: "so true", isQuote: true, resharedFrom: { id: "post_1" } });
    const middle = await createPost("look https://app.zudomart.com/post/post_1 here");
    expect(middle.text).toBe("look https://app.zudomart.com/post/post_1 here");
    expect(middle.resharedFrom?.id).toBe("post_1");
  });

  it("keeps the link as text when the preview was removed or the post is missing", async () => {
    expect((await createPost("keep https://app.zudomart.com/post/post_1", null)).resharedFrom ?? null).toBeNull();
    expect((await createPost("gone https://app.zudomart.com/post/nope_404")).resharedFrom ?? null).toBeNull();
    expect(await failureOf(createPost("x", "nope_404"))).toMatchObject({ status: 422, code: "QUOTED_POST_UNAVAILABLE" });
  });

  it("embeds a quoted post in a comment and lists it with the Author flag and a chain", async () => {
    const post = await createPost("my post");
    const comment = await createComment(post.id, "agree https://zudomart.com/post/post_1");
    expect(comment).toMatchObject({ text: "agree", isPostAuthor: true, quotedPostUnavailable: false });
    expect(validateAgainstContract(quotedPostSummary, comment.quotedPost)).toEqual([]);
    const reply = await createComment(post.id, "thanks", { parentCommentId: comment.id });
    const listed = await resolveMockApiRequest<Page<CommentWithReplies>>("GET", `/api/v1/posts/${post.id}/comments`, undefined);
    const root = listed.data.find((item) => item.id === comment.id);
    expect(root?.previewReplies.map((item) => item.id)).toEqual([reply.id]);
  });
});

describe("chain hidden reply count", () => {
  const node = (id: string, parentCommentId: string | null, replyCount: number) => ({ id, parentCommentId, replyCount }) as Comment;
  it("counts replies not shown in the chain at every level", () => {
    expect(countRepliesHiddenFromChain(node("r", null, 3), [node("a", "r", 2), node("b", "a", 0)])).toBe(3);
    expect(countRepliesHiddenFromChain(node("r", null, 1), [node("a", "r", 0)])).toBe(0);
  });
});
