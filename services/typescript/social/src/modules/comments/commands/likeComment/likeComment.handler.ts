import { notFound } from "../../../../errors/social.error.js";
import { socialEventTypes } from "../../../../events/eventTypes.event.js";
import { appendDomainEventsToOutbox } from "../../../../events/outbox.event.js";
import type { Handler, HandlerContext } from "../../../../types/handlerContext.type.js";
import { loadPostVisibleToViewer } from "../../../posts/services/postAccess.service.js";
import { commentRepository } from "../../repositories/comment.repository.js";
import { findCommentVisibleToViewer } from "../../services/commentVisibility.service.js";
import type { LikeCommentCommand } from "./likeComment.command.js";

export function createLikeCommentHandler(context: HandlerContext): Handler<LikeCommentCommand, void> {
  return async ({ actorId, commentId }) => {
    const comment = await findCommentVisibleToViewer(context.database.client, commentId, actorId);
    if (comment === null) throw notFound("COMMENT_NOT_FOUND", "Comment not found.");
    await loadPostVisibleToViewer(context, actorId, comment.postId);
    await context.database.transaction(async (transaction) => {
      if (!(await commentRepository.addLike(transaction, commentId, actorId))) return;
      await transaction.comment.update({ where: { id: commentId }, data: { likeCount: { increment: 1 } } });
      await appendDomainEventsToOutbox(transaction, [{ eventType: socialEventTypes.commentLiked, subject: commentId, occurredAt: context.clock.now(), data: { commentId, postId: comment.postId, commentAuthorId: comment.authorId, likedBy: actorId } }]);
    });
  };
}
