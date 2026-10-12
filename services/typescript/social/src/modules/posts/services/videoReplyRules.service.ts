import { forbidden, notFound, unprocessable } from "../../../errors/social.error.js";
import type { HandlerContext } from "../../../types/handlerContext.type.js";
import { blockRepository } from "../../blocks/repositories/block.repository.js";
import type { CommentRow } from "../../comments/repositories/comment.repository.js";
import { findCommentVisibleToViewer } from "../../comments/services/commentVisibility.service.js";
import type { ReplyToComment } from "../models/post.model.js";
import { postRepository } from "../repositories/post.repository.js";

export async function assertAuthorMayReplyToCommentWithVideo(context: HandlerContext, authorId: string, kind: "post" | "clip" | "story", reply: ReplyToComment): Promise<CommentRow> {
  if (kind !== "clip") throw unprocessable("VIDEO_REPLY_REQUIRES_CLIP", "Only a clip can reply to a comment.");
  const db = context.database.client;
  const comment = await findCommentVisibleToViewer(db, reply.commentId, undefined);
  if (comment === null) throw notFound("COMMENT_NOT_FOUND", "Comment not found.");
  if (comment.postId !== reply.clipId || comment.authorId !== reply.commenterUserId) throw unprocessable("VIDEO_REPLY_MISMATCH", "The comment does not match this clip and commenter.");
  const clip = await postRepository.findById(db, reply.clipId);
  if (clip === null || clip.kind !== "clip") throw notFound("CLIP_NOT_FOUND", "Clip not found.");
  if (clip.authorId !== authorId) throw forbidden("NOT_CLIP_AUTHOR", "Only the clip's author can reply with a video.");
  if (await blockRepository.exists(db, comment.authorId, authorId)) throw forbidden("COMMENTER_BLOCKED_AUTHOR", "This person can't receive a video reply.");
  return comment;
}
