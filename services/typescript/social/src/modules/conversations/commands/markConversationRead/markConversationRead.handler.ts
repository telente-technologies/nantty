import type { Handler, HandlerContext } from "../../../../types/handlerContext.type.js";
import { conversationRepository } from "../../repositories/conversation.repository.js";
import { requireConversationMember } from "../../services/conversationAccess.service.js";
import type { MarkConversationReadCommand } from "./markConversationRead.command.js";

export function createMarkConversationReadHandler(context: HandlerContext): Handler<MarkConversationReadCommand, void> {
  return async ({ viewerId, conversationId }) => {
    const { member } = await requireConversationMember(context.database.client, conversationId, viewerId);
    if (member.inboxFolder !== "chats") return;
    await conversationRepository.markRead(context.database.client, conversationId, viewerId, context.clock.now());
  };
}
