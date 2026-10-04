import { forbidden, notFound } from "../../../../errors/social.error.js";
import { socialEventTypes } from "../../../../events/eventTypes.event.js";
import { appendDomainEventsToOutbox } from "../../../../events/outbox.event.js";
import type { Handler, HandlerContext } from "../../../../types/handlerContext.type.js";
import type { PostView } from "../../models/post.model.js";
import { postRepository } from "../../repositories/post.repository.js";
import { buildPostViews } from "../../services/postView.service.js";
import type { UpdateReplySettingsCommand } from "./updateReplySettings.command.js";

export function createUpdateReplySettingsHandler(context: HandlerContext): Handler<UpdateReplySettingsCommand, PostView> {
  return async ({ actorId, postId, replyPolicy }) => {
    const post = await postRepository.findById(context.database.client, postId);
    if (post === null) throw notFound("POST_NOT_FOUND", "Post not found.");
    if (post.authorId !== actorId) throw forbidden("NOT_POST_AUTHOR", "Only the author can change who can reply.");
    const now = context.clock.now();
    const updated = await context.database.transaction(async (transaction) => {
      const row = await postRepository.updateReplyPolicy(transaction, postId, replyPolicy);
      await appendDomainEventsToOutbox(transaction, [{ eventType: socialEventTypes.postUpdated, subject: postId, occurredAt: now, data: { postId, authorId: actorId, kind: row.kind, replyPolicy } }]);
      return row;
    });
    const [view] = await buildPostViews(context, actorId, [updated]);
    return view as PostView;
  };
}
