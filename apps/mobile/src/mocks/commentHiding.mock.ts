import { ApiError } from "@/errors/api.error";
import type { Comment, CommentHiddenState, MyPostComment } from "@/types";

import { commentsByPostId, commentsForPost, findCommentAnywhere, replaceStoredComment } from "./comments.mock";
import { me } from "./fixtures.mock";
import { mockPostsState } from "./postCatalog.mock";
import { createMockRoute, type MockRoute } from "./registry.mock";

interface HiddenEntry {
  readonly comment: Comment;
  readonly subtree: readonly Comment[];
  readonly hiddenAt: string;
}

const hiddenById = new Map<string, HiddenEntry>();
const PAGE_SIZE = 20;

const subtreeOf = (postId: string, commentId: string): Comment[] =>
  commentsForPost(postId).filter((c) => c.parentCommentId === commentId).flatMap((reply) => [reply, ...subtreeOf(postId, reply.id)]);

const assertOwnPost = (postId: string, verb: string) => {
  const post = mockPostsState.get(postId);
  if (!post) throw new ApiError(404, "Post not found.", "POST_NOT_FOUND");
  if (post.author.id !== me.id) throw new ApiError(403, `Only the post author can ${verb} a comment.`, "FORBIDDEN");
  return post;
};

const shiftPostCount = (postId: string, by: number) => {
  const post = mockPostsState.get(postId);
  if (post) mockPostsState.set(postId, { ...post, comments: Math.max(0, post.comments + by) });
};

const stateOf = (postId: string, commentId: string): CommentHiddenState => {
  const hiddenAt = hiddenById.get(commentId)?.hiddenAt ?? null;
  return { commentId, postId, hidden: hiddenAt !== null, hiddenAt };
};

const toMyPostComment = ({ comment, hiddenAt }: HiddenEntry): MyPostComment => {
  const post = mockPostsState.get(comment.postId);
  return { ...comment, previewReplies: [], post: { id: comment.postId, kind: post?.kind ?? "post", text: post?.text ?? "", thumbnailUrl: null }, hidden: true, hiddenAt, needsReply: false };
};

export const commentHidingMocks: MockRoute[] = [
  createMockRoute("PUT", "/api/v1/posts/:postId/comments/:commentId/hide", ({ params }) => {
    const postId = params.postId!;
    assertOwnPost(postId, "hide");
    if (hiddenById.has(params.commentId!)) return stateOf(postId, params.commentId!);
    const comment = findCommentAnywhere(params.commentId!);
    if (!comment || comment.postId !== postId) throw new ApiError(404, "Comment not found.", "COMMENT_NOT_FOUND");
    if (comment.author.id === me.id) throw new ApiError(422, "You can't hide your own comment. Delete it instead.", "COMMENT_NOT_HIDEABLE");
    const subtree = subtreeOf(postId, comment.id);
    const removed = new Set([comment.id, ...subtree.map((c) => c.id)]);
    commentsByPostId.set(postId, commentsForPost(postId).filter((c) => !removed.has(c.id)));
    if (comment.parentCommentId) replaceStoredComment(comment.parentCommentId, (c) => ({ ...c, replyCount: Math.max(0, c.replyCount - 1) }));
    shiftPostCount(postId, -removed.size);
    hiddenById.set(comment.id, { comment: { ...comment, isPinned: false, pinnedAt: null }, subtree, hiddenAt: new Date().toISOString() });
    return stateOf(postId, comment.id);
  }),
  createMockRoute("DELETE", "/api/v1/posts/:postId/comments/:commentId/hide", ({ params }) => {
    const postId = params.postId!;
    assertOwnPost(postId, "unhide");
    const entry = hiddenById.get(params.commentId!);
    if (!entry) {
      if (!findCommentAnywhere(params.commentId!)) throw new ApiError(404, "Comment not found.", "COMMENT_NOT_FOUND");
      return stateOf(postId, params.commentId!);
    }
    if (entry.comment.postId !== postId) throw new ApiError(404, "Comment not found.", "COMMENT_NOT_FOUND");
    hiddenById.delete(entry.comment.id);
    commentsByPostId.set(postId, [...commentsForPost(postId), entry.comment, ...entry.subtree]);
    if (entry.comment.parentCommentId) replaceStoredComment(entry.comment.parentCommentId, (c) => ({ ...c, replyCount: c.replyCount + 1 }));
    shiftPostCount(postId, 1 + entry.subtree.length);
    return stateOf(postId, entry.comment.id);
  }),
  createMockRoute("GET", "/api/v1/me/post-comments", ({ query }) => {
    if ((query.get("filter") ?? "all") !== "hidden") return { data: [], nextCursor: null };
    const entries = [...hiddenById.values()].sort((a, b) => b.hiddenAt.localeCompare(a.hiddenAt));
    const start = Number(query.get("cursor") ?? 0) || 0;
    return { data: entries.slice(start, start + PAGE_SIZE).map(toMyPostComment), nextCursor: start + PAGE_SIZE < entries.length ? String(start + PAGE_SIZE) : null };
  }),
];
