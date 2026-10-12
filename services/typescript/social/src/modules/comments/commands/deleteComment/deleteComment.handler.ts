import { forbidden, notFound } from "../../../../errors/social.error.js";
import { socialEventTypes } from "../../../../events/eventTypes.event.js";
import { appendDomainEventsToOutbox } from "../../../../events/outbox.event.js";
import type { Handler, HandlerContext } from "../../../../types/handlerContext.type.js";
import { postRepository } from "../../../posts/repositories/post.repository.js";
import { commentRepository } from "../../repositories/comment.repository.js";
import { commentThreadRepository } from "../../repositories/commentThread.repository.js";
import { isUnderHiddenAncestor, lockPostCommentCounts, publicSubtreeSize } from "../../services/commentVisibility.service.js";
import type { DeleteCommentCommand } from "./deleteComment.command.js";

export function createDeleteCommentHandler(context: HandlerContext): Handler<DeleteCommentCommand, void> {
  return async ({ actorId, commentId }) => {
    const comment = await commentRepository.findLiveIncludingHidden(context.database.client, commentId);
    if (comment === null) throw notFound("COMMENT_NOT_FOUND", "Comment not found.");
    const post = await postRepository.findById(context.database.client, comment.postId);
    if (comment.authorId !== actorId && post?.authorId !== actorId) throw forbidden("FORBIDDEN", "You can only delete your own comments");
    const now = context.clock.now();
    await context.database.transaction(async (transaction) => {
      await lockPostCommentCounts(transaction, comment.postId);
      const current = await commentRepository.findLiveIncludingHidden(transaction, commentId);
      const claimed = await commentRepository.softDeleteMany(transaction, [commentId], now);
      if (claimed.count === 0 || current === null) return;
      const counted = current.hiddenAt !== null || (await isUnderHiddenAncestor(transaction, current)) ? 0 : await publicSubtreeSize(transaction, current);
      const descendantIds = await commentThreadRepository.allDescendantIds(transaction, comment);
      const removed = await commentRepository.softDeleteMany(transaction, descendantIds, now);
      const ids = [commentId, ...descendantIds];
      if (comment.isPinned) await commentRepository.clearPins(transaction, [commentId]);
      if (counted > 0) await postRepository.incrementCounter(transaction, comment.postId, "commentCount", -counted);
      if (comment.parentCommentId !== null && current.hiddenAt === null) await commentRepository.incrementReplies(transaction, comment.parentCommentId, -1);
      await postRepository.decrementQuoteCountsForComments(transaction, ids);
      await appendDomainEventsToOutbox(transaction, [{ eventType: socialEventTypes.commentDeleted, subject: commentId, occurredAt: now, data: { commentId, postId: comment.postId, deletedBy: actorId, removedCount: removed.count + 1 } }]);
    });
  };
}
