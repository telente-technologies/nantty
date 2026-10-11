import { resolveEventActor } from "../../../../events/actor.event.js";
import type { Handler, HandlerContext } from "../../../../types/handlerContext.type.js";
import type { PostView } from "../../models/post.model.js";
import { postRepository } from "../../repositories/post.repository.js";
import { buildPostViews } from "../../services/postView.service.js";
import { loadQuotableTarget, originalAuthorIdFor, quoteOriginalIdFor, recordReshareInTransaction } from "../../services/quoteTarget.service.js";
import type { ResharePostCommand } from "./resharePost.command.js";

export function createResharePostHandler(context: HandlerContext): Handler<ResharePostCommand, PostView> {
  return async ({ actorId, postId, text }) => {
    const target = await loadQuotableTarget(context, actorId, postId);
    const isQuote = text.trim() !== "";
    const originalId = quoteOriginalIdFor(target);
    const now = context.clock.now();
    const actor = await resolveEventActor(context.directory, actorId);
    const originalAuthorId = await originalAuthorIdFor(context, target);
    const created = await context.database.transaction(async (transaction) => {
      if (!isQuote) {
        const existing = await postRepository.findPlainRepost(transaction, actorId, originalId);
        if (existing !== null) return existing;
      }
      const post = await postRepository.create(transaction, { authorId: actorId, kind: "post", text, audience: "everyone", visibility: "public", resharedFromId: originalId, isQuote, createdAt: now });
      await recordReshareInTransaction(transaction, { postId: post.id, originalId, actorId, originalAuthorId, isQuote, now, actor });
      return post;
    });
    const [view] = await buildPostViews(context, actorId, [created]);
    return view as PostView;
  };
}
