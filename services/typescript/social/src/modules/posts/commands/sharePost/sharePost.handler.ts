import { socialEventTypes } from "../../../../events/eventTypes.event.js";
import { appendDomainEventsToOutbox } from "../../../../events/outbox.event.js";
import type { Handler, HandlerContext } from "../../../../types/handlerContext.type.js";
import { postRepository } from "../../repositories/post.repository.js";
import { loadPostVisibleToViewer } from "../../services/postAccess.service.js";
import type { SharePostCommand } from "./sharePost.command.js";

export function createSharePostHandler(context: HandlerContext): Handler<SharePostCommand, void> {
  return async ({ actorId, postId, channel }) => {
    const post = await loadPostVisibleToViewer(context, actorId, postId);
    if (actorId === undefined) return;
    await context.database.transaction(async (transaction) => {
      await postRepository.recordShare(transaction, postId, actorId, channel);
      await postRepository.incrementCounter(transaction, postId, "shareCount", 1);
      await appendDomainEventsToOutbox(transaction, [{ eventType: socialEventTypes.postShared, subject: postId, occurredAt: context.clock.now(), data: { postId, authorId: post.authorId, sharedBy: actorId, channel } }]);
    });
  };
}
