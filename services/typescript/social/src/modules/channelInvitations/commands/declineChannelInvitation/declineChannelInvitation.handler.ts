import { socialEventTypes } from "../../../../events/eventTypes.event.js";
import { appendDomainEventsToOutbox } from "../../../../events/outbox.event.js";
import { conflict, gone, notFound } from "../../../../errors/social.error.js";
import type { Handler, HandlerContext } from "../../../../types/handlerContext.type.js";
import type { ChannelInvitationView } from "../../models/channelInvitation.model.js";
import { channelInvitationRepository } from "../../repositories/channelInvitation.repository.js";
import { toChannelInvitationView } from "../../services/channelInvitationView.service.js";
import type { DeclineChannelInvitationCommand } from "./declineChannelInvitation.command.js";

export function declineChannelInvitationHandler(context: HandlerContext): Handler<DeclineChannelInvitationCommand, ChannelInvitationView> {
  return async ({ inviteeId, invitationId }) => {
    const db = context.database.client;
    let row = await channelInvitationRepository.findById(db, invitationId);
    if (row === null || row.inviteeId !== inviteeId) throw notFound("CHANNEL_INVITATION_NOT_FOUND", "Channel invitation not found.");
    if (row.status === "declined") return toChannelInvitationView(row);
    if (row.status !== "pending") {
      if (row.status === "expired") throw gone("CHANNEL_INVITATION_EXPIRED", "This channel invitation has expired.");
      throw conflict("CHANNEL_INVITATION_ALREADY_SETTLED", "This channel invitation can no longer be declined.");
    }
    const now = context.clock.now();
    if (row.expiresAt.getTime() <= now.getTime()) {
      await db.channelInvitation.updateMany({ where: { id: row.id, status: "pending" }, data: { status: "expired", respondedAt: now } });
      throw gone("CHANNEL_INVITATION_EXPIRED", "This channel invitation has expired.");
    }
    await context.database.transaction(async (transaction) => {
      const changed = await channelInvitationRepository.settlePending(transaction, invitationId, inviteeId, "declined", now);
      if (changed.count === 0) {
        const current = await channelInvitationRepository.findById(transaction, invitationId);
        if (current?.status === "declined" && current.inviteeId === inviteeId) return;
        if (current === null || current.inviteeId !== inviteeId) throw notFound("CHANNEL_INVITATION_NOT_FOUND", "Channel invitation not found.");
        throw conflict("CHANNEL_INVITATION_ALREADY_SETTLED", "This channel invitation has already been answered.");
      }
      await appendDomainEventsToOutbox(transaction, [{
        eventType: socialEventTypes.channelInvitationDeclined,
        subject: invitationId,
        occurredAt: now,
        data: { invitationId, channelId: row!.conversationId, inviterId: row!.inviterId, inviteeId },
      }]);
    });
    row = await channelInvitationRepository.findById(db, invitationId);
    if (row === null) throw notFound("CHANNEL_INVITATION_NOT_FOUND", "Channel invitation not found.");
    return toChannelInvitationView(row);
  };
}
