import { socialEventTypes } from "../../../../events/eventTypes.event.js";
import { appendDomainEventsToOutbox } from "../../../../events/outbox.event.js";
import { conflict, forbidden, gone, notFound } from "../../../../errors/social.error.js";
import { maximumGroupMembers } from "../../../../constants/social.constant.js";
import type { Handler, HandlerContext } from "../../../../types/handlerContext.type.js";
import { blockRepository } from "../../../blocks/repositories/block.repository.js";
import type { GroupInvitationView } from "../../models/groupInvitation.model.js";
import { groupInvitationRepository } from "../../repositories/groupInvitation.repository.js";
import { groupInvitationLinkRepository } from "../../repositories/groupInvitationLink.repository.js";
import { toGroupInvitationViews } from "../../services/groupInvitationView.service.js";
import { hashGroupInvitationLinkToken } from "../../services/groupInvitationLinkToken.service.js";
import type { ClaimGroupInvitationLinkCommand } from "./claimGroupInvitationLink.command.js";

export function claimGroupInvitationLinkHandler(context: HandlerContext): Handler<ClaimGroupInvitationLinkCommand, GroupInvitationView> {
  return async ({ inviteeId, token }) => {
    const db = context.database.client;
    const now = context.clock.now();
    const tokenHash = hashGroupInvitationLinkToken(token);
    const link = await groupInvitationLinkRepository.findActiveByTokenHash(db, tokenHash, now);
    if (link === null) throw notFound("GROUP_INVITATION_LINK_NOT_FOUND", "This group invitation link is unavailable.");
    if (link.conversation.kind !== "group") throw notFound("GROUP_INVITATION_LINK_NOT_FOUND", "This group invitation link is unavailable.");
    if (link.conversation.members.some((member) => member.accountId === inviteeId)) throw conflict("ALREADY_GROUP_MEMBER", "You are already a member of this group.");
    if (await blockRepository.hasBlockedPairWithAny(db, inviteeId, link.conversation.members.map((member) => member.accountId))) {
      throw forbidden("GROUP_INVITATION_BLOCKED", "This invitation cannot be requested because one of the accounts has blocked the other.");
    }

    const row = await context.database.transaction(async (transaction) => {
      const currentLink = await groupInvitationLinkRepository.findActiveByTokenHash(transaction, tokenHash, now);
      if (currentLink === null) throw gone("GROUP_INVITATION_LINK_UNAVAILABLE", "This group invitation link has expired or was revoked.");
      if (currentLink.conversation.kind !== "group") throw notFound("GROUP_INVITATION_LINK_NOT_FOUND", "This group invitation link is unavailable.");
      if (currentLink.conversation.members.some((member) => member.accountId === inviteeId)) throw conflict("ALREADY_GROUP_MEMBER", "You are already a member of this group.");
      await groupInvitationRepository.updatePendingForPair(transaction, currentLink.conversationId, inviteeId, now);
      const existing = await groupInvitationRepository.findPair(transaction, currentLink.conversationId, inviteeId);
      if (existing?.status === "accepted") throw conflict("GROUP_INVITATION_ALREADY_ACCEPTED", "You have already accepted; secure key handoff is still required before membership can begin.");
      if (existing?.status === "pending") return existing;
      const openInvitations = await groupInvitationRepository.countOpenForConversation(transaction, currentLink.conversationId, now);
      if (existing === null && currentLink.conversation.members.length + openInvitations >= maximumGroupMembers) {
        throw conflict("GROUP_FULL", `A group can have up to ${maximumGroupMembers} members and pending invitees.`);
      }
      const expiresAt = new Date(Math.min(currentLink.expiresAt.getTime(), now.getTime() + 7 * 24 * 60 * 60 * 1000));
      const invitation = existing === null
        ? await groupInvitationRepository.create(transaction, {
          conversationId: currentLink.conversationId, inviterId: currentLink.createdById, inviteeId,
          status: "pending", createdAt: now, expiresAt,
        })
        : await groupInvitationRepository.update(transaction, existing.id, {
          inviterId: currentLink.createdById, status: "pending", createdAt: now, expiresAt, respondedAt: null,
        });
      await appendDomainEventsToOutbox(transaction, [{
        eventType: socialEventTypes.groupInvitationCreated,
        subject: invitation.id,
        occurredAt: now,
        data: { invitationId: invitation.id, conversationId: currentLink.conversationId, inviterId: currentLink.createdById, inviteeId, expiresAt: expiresAt.toISOString(), source: "shareable_link" },
      }]);
      return invitation;
    });
    return (await toGroupInvitationViews(context, [row], inviteeId))[0]!;
  };
}
