import { appendDomainEventsToOutbox } from "../../../../events/outbox.event.js";
import { conversationUpdatedEvent, membershipEndedEvent } from "../../../messages/services/chatRealtimeEvents.service.js";
import { forbidden, notFound } from "../../../../errors/social.error.js";
import type { Handler, HandlerContext } from "../../../../types/handlerContext.type.js";
import { conversationRepository } from "../../repositories/conversation.repository.js";
import { requireConversationMember, requireGroupAdmin } from "../../services/conversationAccess.service.js";
import type { RemoveGroupMemberCommand } from "./removeGroupMember.command.js";

export function createRemoveGroupMemberHandler(context: HandlerContext): Handler<RemoveGroupMemberCommand, void> {
  return async ({ actorId, conversationId, userId }) => {
    const access = await requireConversationMember(context.database.client, conversationId, actorId);
    requireGroupAdmin(access);
    const target = access.conversation.members.find((member) => member.accountId === userId);
    if (target === undefined) throw notFound("MEMBER_NOT_FOUND", "That person isn't in this group.");
    if (target.role === "owner") throw forbidden("CANNOT_REMOVE_OWNER", "The owner can't be removed.");
    if (target.role === "admin" && access.member.role !== "owner") throw forbidden("ONLY_OWNER_REMOVES_ADMINS", "Only the owner can remove an admin.");
    const now = context.clock.now();
    await context.database.transaction(async (transaction) => {
      await conversationRepository.updateMember(transaction, conversationId, userId, { leftAt: now, unreadCount: 0 });
      await appendDomainEventsToOutbox(transaction, [
        membershipEndedEvent(conversationId, userId, "removed", now, actorId),
        conversationUpdatedEvent(conversationId, { memberRemoved: userId }, now, { memberIds: access.conversation.members.filter((member) => member.accountId !== userId).map((member) => member.accountId) }),
      ]);
    });
  };
}
