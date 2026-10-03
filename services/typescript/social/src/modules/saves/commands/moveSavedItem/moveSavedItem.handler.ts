import { notFound } from "../../../../errors/social.error.js";
import type { Handler, HandlerContext } from "../../../../types/handlerContext.type.js";
import type { SavedItemView } from "../../models/saved.model.js";
import { saveCollectionRepository } from "../../repositories/saveCollection.repository.js";
import { savedItemRepository } from "../../repositories/savedItem.repository.js";
import { buildSavedItemViews } from "../../services/savedItemView.service.js";
import type { MoveSavedItemCommand } from "./moveSavedItem.command.js";

export function createMoveSavedItemHandler(context: HandlerContext): Handler<MoveSavedItemCommand, SavedItemView> {
  return async ({ userId, saveId, collectionId }) => {
    const db = context.database.client;
    const item = await savedItemRepository.findById(db, saveId);
    if (item === null || item.userId !== userId) throw notFound("SAVED_ITEM_NOT_FOUND", "Saved item not found.");
    if (collectionId !== null && (await saveCollectionRepository.findOwned(db, userId, collectionId)) === null) throw notFound("COLLECTION_NOT_FOUND", "Collection not found.");
    const updated = await savedItemRepository.setCollection(db, saveId, collectionId);
    const [view] = await buildSavedItemViews(context, userId, [updated]);
    if (view === undefined) throw notFound("SAVED_ITEM_NOT_FOUND", "Saved item not found.");
    return view;
  };
}
