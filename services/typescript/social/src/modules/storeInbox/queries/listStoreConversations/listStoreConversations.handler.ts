import type { Handler, HandlerContext } from "../../../../types/handlerContext.type.js";
import type { StoreConversationPage } from "../../models/storeInbox.model.js";
import { storeInboxRepository } from "../../repositories/storeInbox.repository.js";
import { buildStoreConversationViews } from "../../services/storeInboxView.service.js";
import type { ListStoreConversationsQuery } from "./listStoreConversations.query.js";

const scanLimit = 500;

export function createListStoreConversationsHandler(context: HandlerContext): Handler<ListStoreConversationsQuery, StoreConversationPage> {
  return async (query) => {
    const db = context.database.client;
    const filtering = query.filter === "unread" || (query.text !== undefined && query.text.trim() !== "");
    const rows = await storeInboxRepository.listForStore(db, query.storeId, query.filter === "orders", filtering ? scanLimit : query.limit, query.cursor);
    const unreadConversationsCount = await storeInboxRepository.countUnreadForStore(db, query.storeId);
    if (!filtering) {
      const page = rows.slice(0, query.limit);
      const views = await buildStoreConversationViews(context, db, query.storeId, page);
      return { data: views, nextCursor: rows.length > query.limit ? (page[page.length - 1]?.id ?? null) : null, unreadConversationsCount };
    }
    const text = (query.text ?? "").trim().toLowerCase().replace(/^@/, "");
    const views = (await buildStoreConversationViews(context, db, query.storeId, rows)).filter((view) =>
      (query.filter !== "unread" || view.unreadCount > 0) &&
      (text === "" || [view.customer.name, view.customer.username, view.orderNumber ?? "", view.lastMessage?.body ?? ""].some((candidate) => candidate.toLowerCase().includes(text))));
    const page = views.slice(0, query.limit);
    return { data: page, nextCursor: views.length > query.limit ? (page[page.length - 1]?.id ?? null) : null, unreadConversationsCount };
  };
}
