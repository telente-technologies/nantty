import { appendDomainEventsToOutbox } from "../../../../events/outbox.event.js";
import { conversationUpdatedEvent } from "../../../messages/services/chatRealtimeEvents.service.js";
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
      if (addable.length > 0) await appendDomainEventsToOutbox(transaction, [conversationUpdatedEvent(conversationId, { membersAdded: addable }, context.clock.now(), { memberIds: [...access.conversation.members.map((member) => member.accountId), ...addable] })]);
    });
    return listMemberViews(context, conversationId);
  };
}
