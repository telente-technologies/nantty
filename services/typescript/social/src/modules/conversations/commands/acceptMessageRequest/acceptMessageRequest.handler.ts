import { socialEventTypes } from "../../../../events/eventTypes.event.js";
import { appendDomainEventsToOutbox } from "../../../../events/outbox.event.js";
import type { Handler, HandlerContext } from "../../../../types/handlerContext.type.js";
import type { ConversationView } from "../../models/conversation.model.js";
import { conversationRepository } from "../../repositories/conversation.repository.js";
import { requireConversationMember } from "../../services/conversationAccess.service.js";
import { loadConversationViewForMember } from "../../services/conversationViewById.service.js";
import type { AcceptMessageRequestCommand } from "./acceptMessageRequest.command.js";

export function createAcceptMessageRequestHandler(context: HandlerContext): Handler<AcceptMessageRequestCommand, ConversationView> {
  return async ({ viewerId, conversationId }) => {
    const { conversation, member } = await requireConversationMember(context.database.client, conversationId, viewerId);
    if (member.inboxFolder !== "chats") {
      await context.database.transaction(async (transaction) => {
        await conversationRepository.updateMember(transaction, conversationId, viewerId, { inboxFolder: "chats", restricted: false, spamReason: null });
        await appendDomainEventsToOutbox(transaction, [{ eventType: socialEventTypes.messageRequestAccepted, subject: conversationId, occurredAt: context.clock.now(), data: { conversationId, acceptedBy: viewerId, memberIds: conversation.members.map((candidate) => candidate.accountId) } }]);
      });
    }
    return loadConversationViewForMember(context, conversationId, viewerId);
  };
}
