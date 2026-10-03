import type { Handler, HandlerContext } from "../../../../types/handlerContext.type.js";
import { conversationRepository } from "../../repositories/conversation.repository.js";
import { requireConversationMember } from "../../services/conversationAccess.service.js";
import type { DeleteConversationCommand } from "./deleteConversation.command.js";

export function createDeleteConversationHandler(context: HandlerContext): Handler<DeleteConversationCommand, void> {
  return async ({ viewerId, conversationId }) => {
    await requireConversationMember(context.database.client, conversationId, viewerId);
    await conversationRepository.updateMember(context.database.client, conversationId, viewerId, { leftAt: context.clock.now(), unreadCount: 0 });
  };
}
