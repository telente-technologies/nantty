import type { Comment, ReplyToComment } from "@/types";

export function canReplyToCommentWithVideo(comment: Comment, clipId: string): boolean {
  return comment.postId === clipId && !comment.id.startsWith("pending_") && comment.videoReplyBlocked !== true;
}

export function buildClipVideoReplyTarget(comment: Comment, clipId: string): ReplyToComment | null {
  if (!canReplyToCommentWithVideo(comment, clipId)) return null;
  return { commentId: comment.id, clipId, commenterUserId: comment.author.id };
}

export function clipVideoReplyHref(target: ReplyToComment): string {
  const query = new URLSearchParams({ replyCommentId: target.commentId, replyClipId: target.clipId, replyCommenterUserId: target.commenterUserId });
  return `/create/clip?${query.toString()}`;
}

export function readClipVideoReplyTarget(params: URLSearchParams): ReplyToComment | undefined {
  const commentId = params.get("replyCommentId");
  const clipId = params.get("replyClipId");
  const commenterUserId = params.get("replyCommenterUserId");
  return commentId && clipId && commenterUserId ? { commentId, clipId, commenterUserId } : undefined;
}
