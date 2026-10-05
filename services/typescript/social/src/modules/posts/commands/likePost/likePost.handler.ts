import { socialEventTypes } from "../../../../events/eventTypes.event.js";
import { appendDomainEventsToOutbox } from "../../../../events/outbox.event.js";
import type { Handler, HandlerContext } from "../../../../types/handlerContext.type.js";
import { postRepository } from "../../repositories/post.repository.js";
import { loadPostVisibleToViewer } from "../../services/postAccess.service.js";
import type { LikePostCommand } from "./likePost.command.js";

export function createLikePostHandler(context: HandlerContext): Handler<LikePostCommand, void> {
  return async ({ actorId, postId }) => {
    const post = await loadPostVisibleToViewer(context, actorId, postId);
    const now = context.clock.now();
    await context.database.transaction(async (transaction) => {
      if (!(await postRepository.addLike(transaction, postId, actorId))) return;
      await postRepository.incrementCounter(transaction, postId, "likeCount", 1);
      await appendDomainEventsToOutbox(transaction, [{ eventType: socialEventTypes.postLiked, subject: postId, occurredAt: now, data: { postId, authorId: post.authorId, postAuthorId: post.authorId, actorId, topics: post.topics, likedBy: actorId } }]);
    });
  };
}
