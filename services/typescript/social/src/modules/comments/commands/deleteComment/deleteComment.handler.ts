import { forbidden, notFound } from "../../../../errors/social.error.js";
import { socialEventTypes } from "../../../../events/eventTypes.event.js";
import { appendDomainEventsToOutbox } from "../../../../events/outbox.event.js";
import type { Handler, HandlerContext } from "../../../../types/handlerContext.type.js";
import { postRepository } from "../../../posts/repositories/post.repository.js";
import { commentRepository } from "../../repositories/comment.repository.js";
import { commentThreadRepository } from "../../repositories/commentThread.repository.js";
import type { DeleteCommentCommand } from "./deleteComment.command.js";


export function createDeleteCommentHandler(context: HandlerContext): Handler<DeleteCommentCommand, void> {
  return async ({ actorId, commentId }) => {
    const comment = await commentRepository.findById(context.database.client, commentId);
    if (comment === null) throw notFound("COMMENT_NOT_FOUND", "Comment not found.");
    const post = await postRepository.findById(context.database.client, comment.postId);
    if (comment.authorId !== actorId && post?.authorId !== actorId) throw forbidden("FORBIDDEN", "You can only delete your own comments");
    const ids = [commentId, ...(await commentThreadRepository.allDescendantIds(context.database.client, comment))];
    const now = context.clock.now();
    await context.database.transaction(async (transaction) => {
      const removed = await commentRepository.softDeleteMany(transaction, ids, now);
      if (comment.isPinned) await commentRepository.clearPins(transaction, [commentId]);
      await postRepository.incrementCounter(transaction, comment.postId, "commentCount", -removed.count);
      if (comment.parentCommentId !== null) await commentRepository.incrementReplies(transaction, comment.parentCommentId, -1);
      await appendDomainEventsToOutbox(transaction, [{ eventType: socialEventTypes.commentDeleted, subject: commentId, occurredAt: now, data: { commentId, postId: comment.postId, deletedBy: actorId, removedCount: removed.count } }]);
    });
  };
}
