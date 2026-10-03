import type { Handler, HandlerContext } from "../../../../types/handlerContext.type.js";
import type { ConversationView } from "../../models/conversation.model.js";
import { conversationRepository } from "../../repositories/conversation.repository.js";
import { requireConversationMember } from "../../services/conversationAccess.service.js";
import { loadConversationViewForMember } from "../../services/conversationViewById.service.js";
import type { MarkConversationNotSpamCommand } from "./markConversationNotSpam.command.js";

export function createMarkConversationNotSpamHandler(context: HandlerContext): Handler<MarkConversationNotSpamCommand, ConversationView> {
  return async ({ viewerId, conversationId }) => {
    const { member } = await requireConversationMember(context.database.client, conversationId, viewerId);
    if (member.inboxFolder === "spam") await conversationRepository.updateMember(context.database.client, conversationId, viewerId, { inboxFolder: "requests", spamReason: null });
    return loadConversationViewForMember(context, conversationId, viewerId);
  };
}
