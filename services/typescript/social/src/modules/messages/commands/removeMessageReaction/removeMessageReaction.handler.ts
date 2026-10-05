import { appendDomainEventsToOutbox } from "../../../../events/outbox.event.js";
import { activeMemberIds, reactionsChangedEvent } from "../../services/chatRealtimeEvents.service.js";
import type { Handler, HandlerContext } from "../../../../types/handlerContext.type.js";
import type { MessageReactionSummary } from "../../models/message.model.js";
import { messageRepository } from "../../repositories/message.repository.js";
import { loadMessageForMember } from "../../services/messageAccess.service.js";
import { summariseMessageReactions } from "../../services/messageView.service.js";
import type { RemoveMessageReactionCommand } from "./removeMessageReaction.command.js";

export function createRemoveMessageReactionHandler(context: HandlerContext): Handler<RemoveMessageReactionCommand, MessageReactionSummary[]> {
  return async ({ viewerId, messageId, emoji }) => {
    await loadMessageForMember(context, messageId, viewerId);
    await messageRepository.removeReaction(context.database.client, messageId, viewerId, emoji);
    const updated = await loadMessageForMember(context, messageId, viewerId);
    await appendDomainEventsToOutbox(context.database.client, [reactionsChangedEvent(updated, await activeMemberIds(context.database.client, updated.conversationId), context.clock.now())]);
    return summariseMessageReactions(updated, viewerId);
  };
}
