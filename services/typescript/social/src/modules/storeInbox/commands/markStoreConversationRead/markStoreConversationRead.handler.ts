import { notFound } from "../../../../errors/social.error.js";
import type { Handler, HandlerContext } from "../../../../types/handlerContext.type.js";
import { conversationRepository } from "../../../conversations/repositories/conversation.repository.js";
import type { StoreConversationView } from "../../models/storeInbox.model.js";
import { storeInboxRepository } from "../../repositories/storeInbox.repository.js";
import { buildStoreConversationViews } from "../../services/storeInboxView.service.js";
import type { MarkStoreConversationReadCommand } from "./markStoreConversationRead.command.js";

export function createMarkStoreConversationReadHandler(context: HandlerContext): Handler<MarkStoreConversationReadCommand, StoreConversationView> {
  return async (command) => {
    const db = context.database.client;
    if ((await storeInboxRepository.findForStore(db, command.storeId, command.conversationId)) === null) throw notFound("CONVERSATION_NOT_FOUND", "That conversation could not be found.");
    await conversationRepository.markRead(db, command.conversationId, command.storeId, context.clock.now());
    const refreshed = await storeInboxRepository.findForStore(db, command.storeId, command.conversationId);
    return (await buildStoreConversationViews(context, db, command.storeId, [refreshed as NonNullable<typeof refreshed>]))[0] as StoreConversationView;
  };
}
