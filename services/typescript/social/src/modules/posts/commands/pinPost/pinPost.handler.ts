import { conflict, forbidden, unprocessable } from "../../../../errors/social.error.js";
import { socialEventTypes } from "../../../../events/eventTypes.event.js";
import { appendDomainEventsToOutbox } from "../../../../events/outbox.event.js";
import type { Handler, HandlerContext } from "../../../../types/handlerContext.type.js";
import type { PostView } from "../../models/post.model.js";
import { postRepository } from "../../repositories/post.repository.js";
import { loadPostVisibleToViewer } from "../../services/postAccess.service.js";
import { buildPostViews } from "../../services/postView.service.js";
import type { PinPostCommand } from "./pinPost.command.js";

export const maximumPinnedPostsPerAuthor = 3;

export function createPinPostHandler(context: HandlerContext): Handler<PinPostCommand, PostView> {
  return async ({ actorId, postId }) => {
    const post = await loadPostVisibleToViewer(context, actorId, postId);
    if (post.authorId !== actorId) throw forbidden("FORBIDDEN", "You can only pin your own posts.");
    if (post.kind === "story") throw unprocessable("POST_NOT_PINNABLE", "Stories can't be pinned to your profile.");
    const pinnedRow = post.isPinned
      ? post
      : await context.database.transaction(async (transaction) => {
          if ((await postRepository.countPinnedByAuthor(transaction, actorId)) >= maximumPinnedPostsPerAuthor) {
            throw conflict("PIN_LIMIT_REACHED", `You can only pin up to ${maximumPinnedPostsPerAuthor} posts on your profile.`);
          }
          const now = context.clock.now();
          const updated = await postRepository.setPinned(transaction, postId, now);
          await appendDomainEventsToOutbox(transaction, [{ eventType: socialEventTypes.postPinned, subject: postId, occurredAt: now, data: { postId, authorId: actorId, kind: post.kind } }]);
          return updated;
        });
    const [view] = await buildPostViews(context, actorId, [pinnedRow]);
    return view as PostView;
  };
}
