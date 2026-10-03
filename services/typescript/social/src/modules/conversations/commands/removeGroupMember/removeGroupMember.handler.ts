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
    await conversationRepository.updateMember(context.database.client, conversationId, userId, { leftAt: context.clock.now(), unreadCount: 0 });
  };
}
