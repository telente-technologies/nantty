import { notFound } from "../../../../errors/social.error.js";
import type { Handler, HandlerContext } from "../../../../types/handlerContext.type.js";
import { messageRepository } from "../../../messages/repositories/message.repository.js";
import type { StoreConversationThreadView } from "../../models/storeInbox.model.js";
import { storeInboxRepository } from "../../repositories/storeInbox.repository.js";
import { buildStoreConversationViews, buildStoreMessageViews } from "../../services/storeInboxView.service.js";
import type { GetStoreConversationQuery } from "./getStoreConversation.query.js";

export function createGetStoreConversationHandler(context: HandlerContext): Handler<GetStoreConversationQuery, StoreConversationThreadView> {
  return async (query) => {
    const db = context.database.client;
    const conversation = await storeInboxRepository.findForStore(db, query.storeId, query.conversationId);
    if (conversation === null) throw notFound("CONVERSATION_NOT_FOUND", "That conversation could not be found.");
    const [view] = await buildStoreConversationViews(context, db, query.storeId, [conversation]);
    const conversationView = view as NonNullable<typeof view>;
    const now = context.clock.now();
    const build = (rows: Parameters<typeof buildStoreMessageViews>[2]) => buildStoreMessageViews(context, query.viewerId, rows, conversationView.customer.id, conversationView.customer.name);
    if (query.after !== undefined) return { conversation: conversationView, messages: await build(await messageRepository.listAfter(db, conversation.id, now, query.after)), nextCursor: null };
    const rows = await storeInboxRepository.threadMessages(db, conversation.id, now, query.limit, query.cursor);
    const page = rows.slice(0, query.limit);
    return { conversation: conversationView, messages: await build([...page].reverse()), nextCursor: rows.length > query.limit ? (page[page.length - 1]?.id ?? null) : null };
  };
}
