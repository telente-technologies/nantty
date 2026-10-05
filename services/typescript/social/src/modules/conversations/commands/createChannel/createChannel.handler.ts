import { socialEventTypes } from "../../../../events/eventTypes.event.js";
import { appendDomainEventsToOutbox } from "../../../../events/outbox.event.js";
import type { Handler, HandlerContext } from "../../../../types/handlerContext.type.js";
import type { ConversationView } from "../../models/conversation.model.js";
import { conversationRepository } from "../../repositories/conversation.repository.js";
import { loadConversationViewForMember } from "../../services/conversationViewById.service.js";
import type { CreateChannelCommand } from "./createChannel.command.js";

export function createCreateChannelHandler(context: HandlerContext): Handler<CreateChannelCommand, ConversationView> {
  return async ({ ownerId, name, description, photoMediaId }) => {
    const now = context.clock.now();
    const channel = await context.database.transaction(async (transaction) => {
      const created = await conversationRepository.create(transaction, {
        kind: "channel", title: name.trim(), createdById: ownerId, lastMessageAt: now, createdAt: now, onlyAdminsCanMentionAll: true,
        ...(description === undefined || description.trim() === "" ? {} : { description: description.trim() }), ...(photoMediaId === undefined ? {} : { photoMediaId }),
      }, [{ accountId: ownerId, role: "owner", inboxFolder: "chats" }]);
      await appendDomainEventsToOutbox(transaction, [{ eventType: socialEventTypes.conversationCreated, subject: created.id, occurredAt: now, data: { conversationId: created.id, kind: "channel", createdBy: ownerId, memberIds: [ownerId] } }]);
      return created;
    });
    return loadConversationViewForMember(context, channel.id, ownerId);
  };
}
