import { forbidden, notFound } from "../../../../errors/social.error.js";
import { socialEventTypes } from "../../../../events/eventTypes.event.js";
import { appendDomainEventsToOutbox } from "../../../../events/outbox.event.js";
import type { Handler, HandlerContext } from "../../../../types/handlerContext.type.js";
import { postRepository } from "../../repositories/post.repository.js";
import type { DeletePostCommand } from "./deletePost.command.js";

export function createDeletePostHandler(context: HandlerContext): Handler<DeletePostCommand, void> {
  return async ({ actorId, postId }) => {
    const post = await postRepository.findById(context.database.client, postId);
    if (post === null) throw notFound("POST_NOT_FOUND", "Post not found.");
    if (post.authorId !== actorId) throw forbidden("NOT_POST_OWNER", "Only the author can delete this post.");
    const now = context.clock.now();
    await context.database.transaction(async (transaction) => {
      await postRepository.softDelete(transaction, postId, now);
      if (post.isQuote && post.resharedFromId !== null) await postRepository.incrementCounter(transaction, post.resharedFromId, "quoteCount", -1);
      await appendDomainEventsToOutbox(transaction, [{ eventType: socialEventTypes.postDeleted, subject: postId, occurredAt: now, data: { postId, authorId: actorId, kind: post.kind } }]);
    });
  };
}
