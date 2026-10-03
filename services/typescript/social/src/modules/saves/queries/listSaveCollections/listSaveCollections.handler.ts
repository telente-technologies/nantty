import type { Handler, HandlerContext } from "../../../../types/handlerContext.type.js";
import type { SaveCollectionView } from "../../models/saved.model.js";
import { saveCollectionRepository } from "../../repositories/saveCollection.repository.js";
import { savedItemRepository } from "../../repositories/savedItem.repository.js";
import type { ListSaveCollectionsQuery } from "./listSaveCollections.query.js";

export function createListSaveCollectionsHandler(context: HandlerContext): Handler<ListSaveCollectionsQuery, SaveCollectionView[]> {
  return async ({ userId }) => {
    const db = context.database.client;
    const [collections, counts] = await Promise.all([saveCollectionRepository.listByUser(db, userId), savedItemRepository.countByCollection(db, userId)]);
    return collections.map((collection) => ({ id: collection.id, name: collection.name, itemCount: counts.get(collection.id) ?? 0, coverUrl: null }));
  };
}
