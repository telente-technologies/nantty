import { socialEventTypes } from "../../../../events/eventTypes.event.js";
import { appendDomainEventsToOutbox } from "../../../../events/outbox.event.js";
import { conflict, gone, notFound } from "../../../../errors/social.error.js";
import type { Handler, HandlerContext } from "../../../../types/handlerContext.type.js";
import { groupInvitationRepository } from "../../repositories/groupInvitation.repository.js";
import { conversationRepository } from "../../../conversations/repositories/conversation.repository.js";
import { requireConversationMember, requireGroupAdmin } from "../../../conversations/services/conversationAccess.service.js";
import { toGroupInvitationViews } from "../../services/groupInvitationView.service.js";
import type { GroupInvitationView } from "../../models/groupInvitation.model.js";
import type { RevokeGroupInvitationCommand } from "./revokeGroupInvitation.command.js";

export function createRevokeGroupInvitationHandler(context: HandlerContext): Handler<RevokeGroupInvitationCommand, GroupInvitationView> {
  return async ({ actorId, conversationId, invitationId }) => {
    const db = context.database.client;
    let row = await groupInvitationRepository.findById(db, invitationId);
    if (row === null || row.conversationId !== conversationId) throw notFound("GROUP_INVITATION_NOT_FOUND", "Invitation not found.");
    const conversation = await conversationRepository.findById(db, conversationId);
    if (conversation === null || conversation.kind !== "group") throw notFound("GROUP_NOT_FOUND", "Group not found.");
    if (row.inviterId !== actorId) {
      const access = await requireConversationMember(db, conversationId, actorId);
      requireGroupAdmin(access);
    }
    if (row.status === "revoked") return (await toGroupInvitationViews(context, [row], actorId))[0]!;
    if (row.status === "expired") throw gone("GROUP_INVITATION_EXPIRED", "This group invitation has expired.");
    if (row.status === "declined") throw conflict("GROUP_INVITATION_ALREADY_SETTLED", "A declined invitation cannot be revoked.");

    const now = context.clock.now();
    if (row.status === "pending" && row.expiresAt.getTime() <= now.getTime()) {
      await db.groupMembershipInvitation.updateMany({ where: { id: row.id, status: "pending" }, data: { status: "expired", respondedAt: now } });
      throw gone("GROUP_INVITATION_EXPIRED", "This group invitation has expired.");
    }
    const changed = await context.database.transaction(async (transaction) => {
      const result = await transaction.groupMembershipInvitation.updateMany({
        where: { id: invitationId, conversationId, status: { in: ["pending", "accepted"] } },
        data: { status: "revoked", respondedAt: now },
      });
      if (result.count === 0) return false;
      await appendDomainEventsToOutbox(transaction, [{
        eventType: socialEventTypes.groupInvitationRevoked,
        subject: invitationId,
        occurredAt: now,
        data: { invitationId, conversationId, revokedBy: actorId, inviterId: row!.inviterId, inviteeId: row!.inviteeId },
      }]);
      return true;
    });
    row = await groupInvitationRepository.findById(db, invitationId);
    if (row === null) throw notFound("GROUP_INVITATION_NOT_FOUND", "Invitation not found.");
    if (!changed && row.status !== "revoked") throw conflict("GROUP_INVITATION_ALREADY_SETTLED", "This invitation can no longer be revoked.");
    return (await toGroupInvitationViews(context, [row], actorId))[0]!;
  };
}
