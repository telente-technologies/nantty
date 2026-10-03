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
    if (type !== "product") {
      if (!uuidPattern.test(targetId)) throw unprocessable("INVALID_TARGET", "targetId must be a post id.");
      await loadPostVisibleToViewer(context, userId, targetId);
    }
    if (collectionId !== undefined && (await saveCollectionRepository.findOwned(db, userId, collectionId)) === null) throw notFound("COLLECTION_NOT_FOUND", "Collection not found.");
    await savedItemRepository.upsert(db, userId, type, targetId, collectionId);
  };
}
