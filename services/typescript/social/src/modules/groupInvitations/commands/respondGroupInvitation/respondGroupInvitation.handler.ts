import { socialEventTypes } from "../../../../events/eventTypes.event.js";
import { appendDomainEventsToOutbox } from "../../../../events/outbox.event.js";
import { conflict, gone, notFound } from "../../../../errors/social.error.js";
import type { Handler, HandlerContext } from "../../../../types/handlerContext.type.js";
import { groupInvitationRepository } from "../../repositories/groupInvitation.repository.js";
import { toGroupInvitationViews } from "../../services/groupInvitationView.service.js";
import type { GroupInvitationView } from "../../models/groupInvitation.model.js";
import type { RespondGroupInvitationCommand } from "./respondGroupInvitation.command.js";

export function createRespondGroupInvitationHandler(context: HandlerContext): Handler<RespondGroupInvitationCommand, GroupInvitationView> {
  return async ({ accountId, invitationId, decision }) => {
    const db = context.database.client;
    let row = await groupInvitationRepository.findById(db, invitationId);
    if (row === null || row.inviteeId !== accountId) throw notFound("GROUP_INVITATION_NOT_FOUND", "Invitation not found.");
    if (row.status === "accepted" && decision === "accept") return (await toGroupInvitationViews(context, [row], accountId))[0]!;
    if (row.status === "declined" && decision === "decline") return (await toGroupInvitationViews(context, [row], accountId))[0]!;
    if (row.status !== "pending") {
      if (row.status === "expired") throw gone("GROUP_INVITATION_EXPIRED", "This group invitation has expired.");
      throw conflict("GROUP_INVITATION_ALREADY_SETTLED", "This invitation can no longer be changed.");
    }

    const now = context.clock.now();
    if (row.expiresAt.getTime() <= now.getTime()) {
      await db.groupMembershipInvitation.updateMany({ where: { id: row.id, status: "pending" }, data: { status: "expired", respondedAt: now } });
      throw gone("GROUP_INVITATION_EXPIRED", "This group invitation has expired.");
    }

    const status = decision === "accept" ? "accepted" : "declined";
    const eventType = decision === "accept" ? socialEventTypes.groupInvitationAccepted : socialEventTypes.groupInvitationDeclined;
    const changed = await context.database.transaction(async (transaction) => {
      const result = await groupInvitationRepository.settlePending(transaction, invitationId, accountId, status, now);
      if (result.count === 0) return false;
      await appendDomainEventsToOutbox(transaction, [{
        eventType,
        subject: invitationId,
        occurredAt: now,
        data: { invitationId, conversationId: row!.conversationId, inviterId: row!.inviterId, inviteeId: accountId },
      }]);
      return true;
    });
    row = await groupInvitationRepository.findById(db, invitationId);
    if (row === null) throw notFound("GROUP_INVITATION_NOT_FOUND", "Invitation not found.");
    if (!changed && row.status !== status) {
      if (row.status === "expired") throw gone("GROUP_INVITATION_EXPIRED", "This group invitation has expired.");
      throw conflict("GROUP_INVITATION_ALREADY_SETTLED", "This invitation has already been answered.");
    }
    return (await toGroupInvitationViews(context, [row], accountId))[0]!;
  };
}
