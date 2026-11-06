import { socialEventTypes } from "../../../../events/eventTypes.event.js";
import { appendDomainEventsToOutbox } from "../../../../events/outbox.event.js";
import { conflict, forbidden, gone, notFound } from "../../../../errors/social.error.js";
import type { Handler, HandlerContext } from "../../../../types/handlerContext.type.js";
import { isUniqueConstraintViolationError } from "../../../../utils/prismaError.util.js";
import { blockRepository } from "../../../blocks/repositories/block.repository.js";
import type { ChannelInvitationView } from "../../models/channelInvitation.model.js";
import { channelInvitationRepository } from "../../repositories/channelInvitation.repository.js";
import { channelInvitationLinkRepository } from "../../repositories/channelInvitationLink.repository.js";
import { toChannelInvitationView } from "../../services/channelInvitationView.service.js";
import { hashChannelInvitationLinkToken } from "../../services/channelInvitationLinkToken.service.js";
import type { ClaimChannelInvitationLinkCommand } from "./claimChannelInvitationLink.command.js";

const channelInvitationLifetimeMilliseconds = 7 * 24 * 60 * 60 * 1000;

export function claimChannelInvitationLinkHandler(context: HandlerContext): Handler<ClaimChannelInvitationLinkCommand, ChannelInvitationView> {
  return async ({ inviteeId, token }) => {
    const db = context.database.client;
    const now = context.clock.now();
    const tokenHash = hashChannelInvitationLinkToken(token);
    const link = await channelInvitationLinkRepository.findActiveByTokenHash(db, tokenHash, now);
    if (link === null) throw notFound("CHANNEL_INVITATION_LINK_NOT_FOUND", "This channel invitation link is unavailable.");
    if (link.conversation.members.some((member) => member.accountId === inviteeId)) throw conflict("ALREADY_CHANNEL_SUBSCRIBER", "You already follow this channel.");
    if (await blockRepository.eitherDirection(db, inviteeId, link.conversation.createdById)) {
      throw forbidden("CHANNEL_INVITATION_BLOCKED", "This invitation cannot be requested because one of the accounts has blocked the other.");
    }

    try {
      const row = await context.database.transaction(async (transaction) => {
        const currentLink = await channelInvitationLinkRepository.findActiveByTokenHash(transaction, tokenHash, now);
        if (currentLink === null) throw gone("CHANNEL_INVITATION_LINK_UNAVAILABLE", "This channel invitation link has expired or was revoked.");
        if (currentLink.conversation.members.some((member) => member.accountId === inviteeId)) throw conflict("ALREADY_CHANNEL_SUBSCRIBER", "You already follow this channel.");
        if (await blockRepository.eitherDirection(transaction, inviteeId, currentLink.conversation.createdById)) {
          throw forbidden("CHANNEL_INVITATION_BLOCKED", "This invitation cannot be requested because one of the accounts has blocked the other.");
        }
        await channelInvitationRepository.expirePendingForPair(transaction, currentLink.conversationId, inviteeId, now);
        const existing = await channelInvitationRepository.findPair(transaction, currentLink.conversationId, inviteeId);
        if (existing?.status === "accepted") throw conflict("CHANNEL_INVITATION_ALREADY_ACCEPTED", "You have already accepted this channel invitation.");
        if (existing?.status === "pending") return existing;
        const expiresAt = new Date(Math.min(currentLink.expiresAt.getTime(), now.getTime() + channelInvitationLifetimeMilliseconds));
        const invitation = existing === null
          ? await channelInvitationRepository.create(transaction, {
            conversationId: currentLink.conversationId,
            inviterId: currentLink.createdById,
            inviteeId,
            status: "pending",
            createdAt: now,
            expiresAt,
          })
          : await channelInvitationRepository.update(transaction, existing.id, {
            inviterId: currentLink.createdById,
            status: "pending",
            createdAt: now,
            expiresAt,
            respondedAt: null,
          });
        await appendDomainEventsToOutbox(transaction, [{
          eventType: socialEventTypes.channelInvitationCreated,
          subject: invitation.id,
          occurredAt: now,
          data: { invitationId: invitation.id, channelId: currentLink.conversationId, inviterId: currentLink.createdById, inviteeId, expiresAt: expiresAt.toISOString(), source: "shareable_link" },
        }]);
        return invitation;
      });
      const withConversation = await channelInvitationRepository.findById(db, row.id);
      if (withConversation === null) throw notFound("CHANNEL_INVITATION_NOT_FOUND", "Channel invitation not found.");
      return toChannelInvitationView(withConversation);
    } catch (error) {
      if (!isUniqueConstraintViolationError(error)) throw error;
      const concurrentlyCreated = await channelInvitationRepository.findPair(db, link.conversationId, inviteeId);
      if (concurrentlyCreated === null || concurrentlyCreated.status !== "pending") throw error;
      return toChannelInvitationView(concurrentlyCreated);
    }
  };
}
