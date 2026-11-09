import type { Handler, HandlerContext } from "../../../../types/handlerContext.type.js";
import { savedItemRepository } from "../../repositories/savedItem.repository.js";
import type { GetSavedItemStatusQuery } from "./getSavedItemStatus.query.js";

export function createGetSavedItemStatusHandler(context: HandlerContext): Handler<GetSavedItemStatusQuery, { readonly isSaved: boolean }> {
  return async ({ userId, type, targetId }) => ({
    isSaved: await savedItemRepository.isSaved(context.database.client, userId, type, targetId),
  });
}
