import { unprocessable } from "../../../../errors/social.error.js";
import { socialEventTypes } from "../../../../events/eventTypes.event.js";
import { appendDomainEventsToOutbox } from "../../../../events/outbox.event.js";
import type { Handler, HandlerContext } from "../../../../types/handlerContext.type.js";
import type { PostView } from "../../models/post.model.js";
import { postRepository } from "../../repositories/post.repository.js";
import { loadPostVisibleToViewer } from "../../services/postAccess.service.js";
import { buildPostViews } from "../../services/postView.service.js";
import type { ResharePostCommand } from "./resharePost.command.js";

export function createResharePostHandler(context: HandlerContext): Handler<ResharePostCommand, PostView> {
  return async ({ actorId, postId, text }) => {
    const target = await loadPostVisibleToViewer(context, actorId, postId);
    if (target.kind === "story") throw unprocessable("STORY_CANNOT_BE_RESHARED", "Stories can't be reshared.");
    if (target.visibility === "subscribers" && target.authorId !== actorId) throw unprocessable("SUBSCRIBER_POST_CANNOT_BE_RESHARED", "Subscriber-only posts can't be reshared.");
    const originalId = target.resharedFromId ?? target.id;
    const now = context.clock.now();
    const created = await context.database.transaction(async (transaction) => {
      const post = await postRepository.create(transaction, { authorId: actorId, kind: "post", text, audience: "everyone", visibility: "public", resharedFromId: originalId, createdAt: now });
      await postRepository.incrementCounter(transaction, originalId, "repostCount", 1);
      await appendDomainEventsToOutbox(transaction, [{ eventType: socialEventTypes.postReshared, subject: post.id, occurredAt: now, data: { postId: post.id, originalPostId: originalId, authorId: actorId, originalAuthorId: target.authorId } }]);
      return post;
    });
    const [view] = await buildPostViews(context, actorId, [created]);
    return view as PostView;
  };
}
