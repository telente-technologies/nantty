import { forbidden, notFound, unprocessable } from "../../../../errors/social.error.js";
import { socialEventTypes } from "../../../../events/eventTypes.event.js";
import { appendDomainEventsToOutbox } from "../../../../events/outbox.event.js";
import type { Handler, HandlerContext } from "../../../../types/handlerContext.type.js";
import type { PostView } from "../../models/post.model.js";
import { postRepository, postWithMedia } from "../../repositories/post.repository.js";
import { assertProductsTaggable } from "../../services/postProducts.service.js";
import { buildPostViews } from "../../services/postView.service.js";
import type { SetPostProductsCommand } from "./setPostProducts.command.js";

export function createSetPostProductsHandler(context: HandlerContext): Handler<SetPostProductsCommand, PostView> {
  return async ({ actorId, postId, productIds }) => {
    const post = await postRepository.findById(context.database.client, postId);
    if (post === null) throw notFound("POST_NOT_FOUND", "Post not found.");
    if (post.authorId !== actorId) throw forbidden("NOT_POST_AUTHOR", "Only the author can tag products.");
    if (post.kind === "story") throw unprocessable("PRODUCTS_NOT_ALLOWED", "Stories can't tag products.");
    const taggable = await assertProductsTaggable(context, productIds);
    const now = context.clock.now();
    const updated = await context.database.transaction(async (transaction) => {
      const row = await transaction.post.update({ where: { id: postId }, data: { productIds: taggable }, include: postWithMedia });
      await appendDomainEventsToOutbox(transaction, [{ eventType: socialEventTypes.postUpdated, subject: postId, occurredAt: now, data: { postId, authorId: actorId, kind: row.kind, productIds: taggable } }]);
      return row;
    });
    const [view] = await buildPostViews(context, actorId, [updated]);
    return view as PostView;
  };
}
