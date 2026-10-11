import type { Handler, HandlerContext } from "../../../../types/handlerContext.type.js";
import type { StoreConversationPage } from "../../models/storeInbox.model.js";
import { storeInboxRepository } from "../../repositories/storeInbox.repository.js";
import { buildStoreConversationViews } from "../../services/storeInboxView.service.js";
import type { ListStoreConversationsQuery } from "./listStoreConversations.query.js";

const scanLimit = 500;

export function createListStoreConversationsHandler(context: HandlerContext): Handler<ListStoreConversationsQuery, StoreConversationPage> {
  return async (query) => {
    const db = context.database.client;
    const unreadOnly = query.filter === "unread";
    const rows = await storeInboxRepository.listForStore(db, query.storeId, query.filter === "orders", unreadOnly ? scanLimit : query.limit, query.cursor);
    const unreadConversationsCount = await storeInboxRepository.countUnreadForStore(db, query.storeId);
    if (!unreadOnly) {
      const page = rows.slice(0, query.limit);
      const views = await buildStoreConversationViews(context, db, query.storeId, page);
      return { data: views, nextCursor: rows.length > query.limit ? (page[page.length - 1]?.id ?? null) : null, unreadConversationsCount };
    }
    const scanned = rows.slice(0, scanLimit);
    const views = (await buildStoreConversationViews(context, db, query.storeId, scanned)).filter((view) => view.unreadCount > 0);
    const page = views.slice(0, query.limit);
    const scanCursor = rows.length > scanLimit ? (scanned[scanned.length - 1]?.id ?? null) : null;
    return { data: page, nextCursor: views.length > query.limit ? (page[page.length - 1]?.id ?? null) : scanCursor, unreadConversationsCount };
  };
}
