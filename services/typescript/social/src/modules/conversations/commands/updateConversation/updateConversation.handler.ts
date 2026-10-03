import { forbidden } from "../../../../errors/social.error.js";
import type { Handler, HandlerContext } from "../../../../types/handlerContext.type.js";
import type { ConversationView } from "../../models/conversation.model.js";
import { conversationRepository } from "../../repositories/conversation.repository.js";
import { requireConversationMember, requireGroupAdmin } from "../../services/conversationAccess.service.js";
import { loadConversationViewForMember } from "../../services/conversationViewById.service.js";
import type { UpdateConversationCommand } from "./updateConversation.command.js";

export function createUpdateConversationHandler(context: HandlerContext): Handler<UpdateConversationCommand, ConversationView> {
  return async (command) => {
    const access = await requireConversationMember(context.database.client, command.conversationId, command.viewerId);
    const changesGroupSettings = command.name !== undefined || command.photoMediaId !== undefined || command.onlyAdminsCanMentionAll !== undefined;
    if (changesGroupSettings) requireGroupAdmin(access);
    else if (access.conversation.kind !== "direct" && command.disappearingMessagesSeconds !== undefined) requireGroupAdmin(access);
    if (access.conversation.kind === "direct" && (command.name !== undefined || command.onlyAdminsCanMentionAll !== undefined)) throw forbidden("NOT_A_GROUP", "This setting is for groups.");
    await conversationRepository.update(context.database.client, command.conversationId, {
      ...(command.name === undefined ? {} : { title: command.name }),
      ...(command.photoMediaId === undefined ? {} : { photoMediaId: command.photoMediaId }),
      ...(command.disappearingMessagesSeconds === undefined ? {} : { disappearingMessagesSeconds: command.disappearingMessagesSeconds }),
      ...(command.onlyAdminsCanMentionAll === undefined ? {} : { onlyAdminsCanMentionAll: command.onlyAdminsCanMentionAll }),
    });
    return loadConversationViewForMember(context, command.conversationId, command.viewerId);
  };
}
