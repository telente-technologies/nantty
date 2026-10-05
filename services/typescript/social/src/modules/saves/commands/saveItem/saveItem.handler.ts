import { socialEventTypes } from "../../../../events/eventTypes.event.js";
import { appendDomainEventsToOutbox } from "../../../../events/outbox.event.js";
import { extractHashtags } from "../../../internalSources/services/hashtags.service.js";
import { notFound, unprocessable } from "../../../../errors/social.error.js";
import type { Handler, HandlerContext } from "../../../../types/handlerContext.type.js";
import { loadPostVisibleToViewer } from "../../../posts/services/postAccess.service.js";
import { saveCollectionRepository } from "../../repositories/saveCollection.repository.js";
import { savedItemRepository } from "../../repositories/savedItem.repository.js";
import type { SaveItemCommand } from "./saveItem.command.js";

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function createSaveItemHandler(context: HandlerContext): Handler<SaveItemCommand, void> {
  return async ({ userId, type, targetId, collectionId }) => {
    const db = context.database.client;
    const post = type === "product" ? null : uuidPattern.test(targetId) ? await loadPostVisibleToViewer(context, userId, targetId) : null;
    if (type !== "product" && post === null) throw unprocessable("INVALID_TARGET", "targetId must be a post id.");
    if (collectionId !== undefined && (await saveCollectionRepository.findOwned(db, userId, collectionId)) === null) throw notFound("COLLECTION_NOT_FOUND", "Collection not found.");
    const now = context.clock.now();
    await db.$transaction(async (transaction) => {
      if (!(await savedItemRepository.saveAndCount(transaction, userId, type, targetId, collectionId))) return;
      await appendDomainEventsToOutbox(transaction, [{
        eventType: socialEventTypes.contentSaved, subject: targetId, occurredAt: now,
        data: { actorId: userId, targetType: type, targetId, ...(post === null ? {} : { postId: post.id, postAuthorId: post.authorId, kind: post.kind, topics: post.topics, hashtags: extractHashtags(post.text).slice(0, 20) }) },
      }]);
    });
  };
}
