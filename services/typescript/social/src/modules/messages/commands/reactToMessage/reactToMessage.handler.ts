import type { Handler, HandlerContext } from "../../../../types/handlerContext.type.js";
import type { MessageReactionSummary } from "../../models/message.model.js";
import { messageRepository } from "../../repositories/message.repository.js";
import { loadMessageForMember } from "../../services/messageAccess.service.js";
import { summariseMessageReactions } from "../../services/messageView.service.js";
import type { ReactToMessageCommand } from "./reactToMessage.command.js";

export function createReactToMessageHandler(context: HandlerContext): Handler<ReactToMessageCommand, MessageReactionSummary[]> {
  return async ({ viewerId, messageId, emoji }) => {
    await loadMessageForMember(context, messageId, viewerId);
    await messageRepository.addReaction(context.database.client, messageId, viewerId, emoji);
    return summariseMessageReactions(await loadMessageForMember(context, messageId, viewerId), viewerId);
  };
}
