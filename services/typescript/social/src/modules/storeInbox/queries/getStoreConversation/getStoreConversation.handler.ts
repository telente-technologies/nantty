import { notFound } from "../../../../errors/social.error.js";
import type { Handler, HandlerContext } from "../../../../types/handlerContext.type.js";
import type { StoreConversationThreadView } from "../../models/storeInbox.model.js";
import { storeInboxRepository } from "../../repositories/storeInbox.repository.js";
import { buildStoreConversationViews, buildStoreMessageView } from "../../services/storeInboxView.service.js";
import type { GetStoreConversationQuery } from "./getStoreConversation.query.js";

export function createGetStoreConversationHandler(context: HandlerContext): Handler<GetStoreConversationQuery, StoreConversationThreadView> {
  return async (query) => {
    const db = context.database.client;
    const conversation = await storeInboxRepository.findForStore(db, query.storeId, query.conversationId);
    if (conversation === null) throw notFound("CONVERSATION_NOT_FOUND", "That conversation could not be found.");
    const [view] = await buildStoreConversationViews(context, db, query.storeId, [conversation]);
    const messages = (await storeInboxRepository.threadMessages(db, conversation.id, 200)).reverse();
    const conversationView = view as NonNullable<typeof view>;
    return { conversation: conversationView, messages: messages.map((message) => buildStoreMessageView(message, query.storeId, conversationView.customer.name)) };
  };
}
