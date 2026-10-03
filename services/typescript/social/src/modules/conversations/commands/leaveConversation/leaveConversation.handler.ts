import type { Handler, HandlerContext } from "../../../../types/handlerContext.type.js";
import { conversationRepository } from "../../repositories/conversation.repository.js";
import { requireConversationMember } from "../../services/conversationAccess.service.js";
import type { LeaveConversationCommand } from "./leaveConversation.command.js";

export function createLeaveConversationHandler(context: HandlerContext): Handler<LeaveConversationCommand, void> {
  return async ({ viewerId, conversationId }) => {
    const { conversation, member } = await requireConversationMember(context.database.client, conversationId, viewerId);
    await context.database.transaction(async (transaction) => {
      await conversationRepository.updateMember(transaction, conversationId, viewerId, { leftAt: context.clock.now(), unreadCount: 0 });
      if (member.role !== "owner" || conversation.kind === "direct") return;
      const successor = [...conversation.members].filter((candidate) => candidate.accountId !== viewerId).sort((left, right) => Number(right.role === "admin") - Number(left.role === "admin") || left.joinedAt.getTime() - right.joinedAt.getTime())[0];
      if (successor !== undefined) await conversationRepository.updateMember(transaction, conversationId, successor.accountId, { role: "owner" });
    });
  };
}
