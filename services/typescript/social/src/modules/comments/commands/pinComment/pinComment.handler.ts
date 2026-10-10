import { forbidden, notFound, unprocessable } from "../../../../errors/social.error.js";
import { socialEventTypes } from "../../../../events/eventTypes.event.js";
import { appendDomainEventsToOutbox } from "../../../../events/outbox.event.js";
import type { Handler, HandlerContext } from "../../../../types/handlerContext.type.js";
import { postRepository } from "../../../posts/repositories/post.repository.js";
import { loadPostVisibleToViewer } from "../../../posts/services/postAccess.service.js";
import type { CommentView } from "../../models/comment.model.js";
import { commentRepository } from "../../repositories/comment.repository.js";
import { buildCommentViews } from "../../services/commentView.service.js";
import type { PinCommentCommand } from "./pinComment.command.js";

export function createPinCommentHandler(context: HandlerContext): Handler<PinCommentCommand, CommentView> {
  return async ({ actorId, postId, commentId }) => {
    const post = await loadPostVisibleToViewer(context, actorId, postId);
    if (post.authorId !== actorId) throw forbidden("FORBIDDEN", "Only the post author can pin a comment.");
    const comment = await commentRepository.findById(context.database.client, commentId);
    if (comment === null || comment.postId !== postId) throw notFound("COMMENT_NOT_FOUND", "Comment not found.");
    if (comment.parentCommentId !== null) throw unprocessable("COMMENT_NOT_PINNABLE", "Only top-level comments can be pinned.");
    const pinnedRow = comment.isPinned
      ? comment
      : await context.database.transaction(async (transaction) => {
          const now = context.clock.now();
          await commentRepository.unpinOthersInPost(transaction, postId, commentId);
          const updated = await commentRepository.setPinned(transaction, commentId, now);
          await postRepository.setPinnedComment(transaction, postId, commentId);
          await appendDomainEventsToOutbox(transaction, [{
            eventType: socialEventTypes.commentPinned, subject: commentId, occurredAt: now,
            data: { commentId, postId, commentAuthorId: comment.authorId, pinnedBy: actorId, replacedCommentId: post.pinnedCommentId },
          }]);
          return updated;
        });
    const [view] = await buildCommentViews(context, actorId, [pinnedRow], post.authorId);
    return view as CommentView;
  };
}
