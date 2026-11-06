import { socialEventTypes } from "../../../../events/eventTypes.event.js";
import { appendDomainEventsToOutbox } from "../../../../events/outbox.event.js";
import { conflict, gone, notFound } from "../../../../errors/social.error.js";
import type { Handler, HandlerContext } from "../../../../types/handlerContext.type.js";
import { conversationRepository } from "../../../conversations/repositories/conversation.repository.js";
import type { ChannelInvitationView } from "../../models/channelInvitation.model.js";
import { channelInvitationRepository } from "../../repositories/channelInvitation.repository.js";
import { toChannelInvitationView } from "../../services/channelInvitationView.service.js";
import type { AcceptChannelInvitationCommand } from "./acceptChannelInvitation.command.js";

export function acceptChannelInvitationHandler(context: HandlerContext): Handler<AcceptChannelInvitationCommand, ChannelInvitationView> {
  return async ({ inviteeId, invitationId }) => {
    const db = context.database.client;
    const initial = await channelInvitationRepository.findById(db, invitationId);
    if (initial === null || initial.inviteeId !== inviteeId) throw notFound("CHANNEL_INVITATION_NOT_FOUND", "Channel invitation not found.");
    if (initial.status === "accepted") return toChannelInvitationView(initial);
    if (initial.status !== "pending") {
      if (initial.status === "expired") throw gone("CHANNEL_INVITATION_EXPIRED", "This channel invitation has expired.");
      throw conflict("CHANNEL_INVITATION_ALREADY_SETTLED", "This channel invitation can no longer be accepted.");
    }

    const now = context.clock.now();
    if (initial.expiresAt.getTime() <= now.getTime()) {
      await db.channelInvitation.updateMany({ where: { id: invitationId, inviteeId, status: "pending" }, data: { status: "expired", respondedAt: now } });
      throw gone("CHANNEL_INVITATION_EXPIRED", "This channel invitation has expired.");
    }

    await context.database.transaction(async (transaction) => {
      const changed = await channelInvitationRepository.settlePending(transaction, invitationId, inviteeId, "accepted", now);
      if (changed.count === 0) {
        const current = await channelInvitationRepository.findById(transaction, invitationId);
        if (current?.status === "accepted" && current.inviteeId === inviteeId) {
          // The successful accept already committed membership in the same transaction.
          // A retry must not silently re-subscribe someone who has since left the channel.
          return;
        }
        if (current?.status === "pending" && current.expiresAt.getTime() <= now.getTime()) {
          await transaction.channelInvitation.updateMany({ where: { id: invitationId, status: "pending" }, data: { status: "expired", respondedAt: now } });
          throw gone("CHANNEL_INVITATION_EXPIRED", "This channel invitation has expired.");
        }
        if (current === null || current.inviteeId !== inviteeId) throw notFound("CHANNEL_INVITATION_NOT_FOUND", "Channel invitation not found.");
        throw conflict("CHANNEL_INVITATION_ALREADY_SETTLED", "This channel invitation has already been answered.");
      }
      await conversationRepository.upsertMember(transaction, initial.conversationId, inviteeId, "subscriber", "chats");
      await appendDomainEventsToOutbox(transaction, [{
        eventType: socialEventTypes.channelInvitationAccepted,
        subject: invitationId,
        occurredAt: now,
        data: { invitationId, channelId: initial.conversationId, inviterId: initial.inviterId, inviteeId },
      }]);
    });

    const accepted = await channelInvitationRepository.findById(db, invitationId);
    if (accepted === null) throw notFound("CHANNEL_INVITATION_NOT_FOUND", "Channel invitation not found.");
    return toChannelInvitationView(accepted);
  };
}
