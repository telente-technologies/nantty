import { forbidden, notFound } from "../../../../errors/social.error.js";
import { socialEventTypes } from "../../../../events/eventTypes.event.js";
import { appendDomainEventsToOutbox } from "../../../../events/outbox.event.js";
import type { Handler, HandlerContext } from "../../../../types/handlerContext.type.js";
import { loadPostVisibleToViewer } from "../../../posts/services/postAccess.service.js";
import { commentRepository } from "../../repositories/comment.repository.js";
import type { UnpinCommentCommand } from "./unpinComment.command.js";

export function createUnpinCommentHandler(context: HandlerContext): Handler<UnpinCommentCommand, void> {
  return async ({ actorId, postId, commentId }) => {
    const post = await loadPostVisibleToViewer(context, actorId, postId);
    if (post.authorId !== actorId) throw forbidden("FORBIDDEN", "Only the post author can unpin a comment.");
    const comment = await commentRepository.findById(context.database.client, commentId);
    if (comment === null || comment.postId !== postId) throw notFound("COMMENT_NOT_FOUND", "Comment not found.");
    if (!comment.isPinned) return;
    await context.database.transaction(async (transaction) => {
      await commentRepository.clearPins(transaction, [commentId]);
      await appendDomainEventsToOutbox(transaction, [{ eventType: socialEventTypes.commentUnpinned, subject: commentId, occurredAt: context.clock.now(), data: { commentId, postId, unpinnedBy: actorId } }]);
    });
  };
}
