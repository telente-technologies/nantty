import type { Handler, HandlerContext } from "../../../../types/handlerContext.type.js";
import type { Page } from "../../../../types/pagination.type.js";
import { savesPageSize } from "../../../../constants/social.constant.js";
import type { SavedItemView } from "../../models/saved.model.js";
import { savedItemRepository } from "../../repositories/savedItem.repository.js";
import { buildSavedItemViews } from "../../services/savedItemView.service.js";
import { paginateSavedRows, resolveSavedTypeFilter } from "../../services/savesPagination.service.js";
import type { ListSavedItemsQuery } from "./listSavedItems.query.js";

export function createListSavedItemsHandler(context: HandlerContext): Handler<ListSavedItemsQuery, Page<SavedItemView>> {
  return async ({ userId, type, collectionId, cursor }) => {
    const rows = await savedItemRepository.page(context.database.client, userId, resolveSavedTypeFilter(type), collectionId, savesPageSize, cursor);
    const page = paginateSavedRows(rows);
    return { data: await buildSavedItemViews(context, userId, page.data), nextCursor: page.nextCursor };
  };
}
