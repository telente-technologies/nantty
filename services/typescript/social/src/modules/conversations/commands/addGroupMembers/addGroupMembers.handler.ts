import type { Handler, HandlerContext } from "../../../../types/handlerContext.type.js";
import type { ConversationMemberView } from "../../models/conversation.model.js";
import { conversationRepository } from "../../repositories/conversation.repository.js";
import { requireConversationMember, requireGroupAdmin } from "../../services/conversationAccess.service.js";
import { listMemberViews, resolveAddableMemberIds } from "../../services/groupMembers.service.js";
import type { AddGroupMembersCommand } from "./addGroupMembers.command.js";

export function createAddGroupMembersHandler(context: HandlerContext): Handler<AddGroupMembersCommand, ConversationMemberView[]> {
  return async ({ actorId, conversationId, userIds }) => {
    const access = await requireConversationMember(context.database.client, conversationId, actorId);
    requireGroupAdmin(access);
    const addable = await resolveAddableMemberIds(context, actorId, userIds, access.conversation.members.map((member) => member.accountId));
    await context.database.transaction(async (transaction) => {
      for (const accountId of addable) await conversationRepository.upsertMember(transaction, conversationId, accountId, "member", "chats");
    });
    return listMemberViews(context, conversationId);
  };
}
