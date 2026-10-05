import { appendDomainEventsToOutbox } from "../../../../events/outbox.event.js";
import { conversationReadEvent } from "../../../messages/services/chatRealtimeEvents.service.js";
import type { Handler, HandlerContext } from "../../../../types/handlerContext.type.js";
import { conversationRepository } from "../../repositories/conversation.repository.js";
import { requireConversationMember } from "../../services/conversationAccess.service.js";
import type { MarkConversationReadCommand } from "./markConversationRead.command.js";

export function createMarkConversationReadHandler(context: HandlerContext): Handler<MarkConversationReadCommand, void> {
  return async ({ viewerId, conversationId }) => {
    const { conversation, member } = await requireConversationMember(context.database.client, conversationId, viewerId);
    if (member.inboxFolder !== "chats") return;
    const now = context.clock.now();
    await context.database.transaction(async (transaction) => {
      await conversationRepository.markRead(transaction, conversationId, viewerId, now);
      await appendDomainEventsToOutbox(transaction, [conversationReadEvent(conversationId, viewerId, now, conversation.members.map((candidate) => candidate.accountId))]);
    });
  };
}
