import { notFound } from "../../../../errors/social.error.js";
import { appendDomainEventsToOutbox } from "../../../../events/outbox.event.js";
import type { Handler, HandlerContext } from "../../../../types/handlerContext.type.js";
import { conversationRepository } from "../../../conversations/repositories/conversation.repository.js";
import { conversationReadEvent } from "../../../messages/services/chatRealtimeEvents.service.js";
import type { StoreConversationView } from "../../models/storeInbox.model.js";
import { storeInboxRepository } from "../../repositories/storeInbox.repository.js";
import { storeTeamAudience } from "../../services/storeInboxAudience.service.js";
import { buildStoreConversationViews } from "../../services/storeInboxView.service.js";
import type { MarkStoreConversationReadCommand } from "./markStoreConversationRead.command.js";

export function createMarkStoreConversationReadHandler(context: HandlerContext): Handler<MarkStoreConversationReadCommand, StoreConversationView> {
  return async (command) => {
    const db = context.database.client;
    const conversation = await storeInboxRepository.findForStore(db, command.storeId, command.conversationId);
    if (conversation === null) throw notFound("CONVERSATION_NOT_FOUND", "That conversation could not be found.");
    const now = context.clock.now();
    const audience = [...conversation.members.map((member) => member.accountId), ...(await storeTeamAudience(context, conversation))];
    await context.database.transaction(async (transaction) => {
      await conversationRepository.markRead(transaction, command.conversationId, command.storeId, now);
      await appendDomainEventsToOutbox(transaction, [conversationReadEvent(command.conversationId, command.storeId, now, [...new Set(audience)])]);
    });
    const refreshed = await storeInboxRepository.findForStore(db, command.storeId, command.conversationId);
    return (await buildStoreConversationViews(context, db, command.storeId, [refreshed as NonNullable<typeof refreshed>]))[0] as StoreConversationView;
  };
}
