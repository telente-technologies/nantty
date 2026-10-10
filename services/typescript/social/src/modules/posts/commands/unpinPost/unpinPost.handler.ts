import { forbidden } from "../../../../errors/social.error.js";
import { socialEventTypes } from "../../../../events/eventTypes.event.js";
import { appendDomainEventsToOutbox } from "../../../../events/outbox.event.js";
import type { Handler, HandlerContext } from "../../../../types/handlerContext.type.js";
import type { PostView } from "../../models/post.model.js";
import { postRepository } from "../../repositories/post.repository.js";
import { loadPostVisibleToViewer } from "../../services/postAccess.service.js";
import { buildPostViews } from "../../services/postView.service.js";
import type { UnpinPostCommand } from "./unpinPost.command.js";

export function createUnpinPostHandler(context: HandlerContext): Handler<UnpinPostCommand, PostView> {
  return async ({ actorId, postId }) => {
    const post = await loadPostVisibleToViewer(context, actorId, postId);
    if (post.authorId !== actorId) throw forbidden("FORBIDDEN", "You can only unpin your own posts.");
    const unpinnedRow = !post.isPinned
      ? post
      : await context.database.transaction(async (transaction) => {
          const updated = await postRepository.setPinned(transaction, postId, null);
          await appendDomainEventsToOutbox(transaction, [{ eventType: socialEventTypes.postUnpinned, subject: postId, occurredAt: context.clock.now(), data: { postId, authorId: actorId, kind: post.kind } }]);
          return updated;
        });
    const [view] = await buildPostViews(context, actorId, [unpinnedRow]);
    return view as PostView;
  };
}
