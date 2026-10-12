import { forbidden, notFound, unprocessable } from "../../../errors/social.error.js";
import { socialEventTypes } from "../../../events/eventTypes.event.js";
import { appendDomainEventsToOutbox } from "../../../events/outbox.event.js";
import type { HandlerContext } from "../../../types/handlerContext.type.js";
import { loadPostVisibleToViewer } from "../../posts/services/postAccess.service.js";
import type { CommentHiddenState } from "../models/comment.model.js";
import { commentRepository } from "../repositories/comment.repository.js";
import { lockPostCommentCounts, shiftPublicCountsFor } from "./commentVisibility.service.js";

interface HidingRequest {
  readonly actorId: string;
  readonly postId: string;
  readonly commentId: string;
}

const stateOf = (postId: string, commentId: string, hiddenAt: Date | null): CommentHiddenState => ({ commentId, postId, hidden: hiddenAt !== null, hiddenAt: hiddenAt?.toISOString() ?? null });

export async function setCommentHidden(context: HandlerContext, { actorId, postId, commentId }: HidingRequest, hide: boolean): Promise<CommentHiddenState> {
  const post = await loadPostVisibleToViewer(context, actorId, postId);
  if (post.authorId !== actorId) throw forbidden("FORBIDDEN", `Only the post author can ${hide ? "hide" : "unhide"} a comment.`);
  const comment = await commentRepository.findLiveIncludingHidden(context.database.client, commentId);
  if (comment === null || comment.postId !== postId) throw notFound("COMMENT_NOT_FOUND", "Comment not found.");
  if (comment.authorId === actorId) throw unprocessable("COMMENT_NOT_HIDEABLE", "You can't hide your own comment. Delete it instead.");
  const now = context.clock.now();
  return context.database.transaction(async (transaction) => {
    if (!(await lockPostCommentCounts(transaction, postId))) throw notFound("POST_NOT_FOUND", "Post not found.");
    const claimed = await transaction.comment.updateMany({
      where: { id: commentId, deletedAt: null, hiddenAt: hide ? null : { not: null } },
      data: hide ? { hiddenAt: now, hiddenByUserId: actorId } : { hiddenAt: null, hiddenByUserId: null },
    });
    const current = await commentRepository.findLiveIncludingHidden(transaction, commentId);
    if (current === null) throw notFound("COMMENT_NOT_FOUND", "Comment not found.");
    if (claimed.count === 0) return stateOf(postId, commentId, current.hiddenAt);
    await shiftPublicCountsFor(transaction, current, hide ? -1 : 1);
    if (hide && current.isPinned) await commentRepository.clearPins(transaction, [commentId]);
    await appendDomainEventsToOutbox(transaction, [{
      eventType: hide ? socialEventTypes.commentHidden : socialEventTypes.commentUnhidden, subject: commentId, occurredAt: now,
      data: { commentId, postId, commentAuthorId: current.authorId, parentCommentId: current.parentCommentId, actorId },
    }]);
    return stateOf(postId, commentId, current.hiddenAt);
  });
}
