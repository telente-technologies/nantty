import type { Handler, HandlerContext } from "../../../../types/handlerContext.type.js";
import { conversationRepository } from "../../repositories/conversation.repository.js";
import { requireConversationMember } from "../../services/conversationAccess.service.js";
import type { RestrictConversationCommand } from "./restrictConversation.command.js";

export function createRestrictConversationHandler(context: HandlerContext): Handler<RestrictConversationCommand, void> {
  return async ({ viewerId, conversationId }) => {
    await requireConversationMember(context.database.client, conversationId, viewerId);
    await conversationRepository.updateMember(context.database.client, conversationId, viewerId, { inboxFolder: "requests", restricted: true });
  };
}
