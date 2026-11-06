import { socialEventTypes } from "../../../../events/eventTypes.event.js";
import { appendDomainEventsToOutbox } from "../../../../events/outbox.event.js";
import { conflict, forbidden, notFound } from "../../../../errors/social.error.js";
import { maximumGroupMembers } from "../../../../constants/social.constant.js";
import { isUniqueConstraintViolationError } from "../../../../utils/prismaError.util.js";
import type { Handler, HandlerContext } from "../../../../types/handlerContext.type.js";
import { blockRepository } from "../../../blocks/repositories/block.repository.js";
import { requireConversationMember, requireGroupAdmin } from "../../../conversations/services/conversationAccess.service.js";
import { groupInvitationRepository } from "../../repositories/groupInvitation.repository.js";
import { toGroupInvitationViews } from "../../services/groupInvitationView.service.js";
import type { GroupInvitationView } from "../../models/groupInvitation.model.js";
import type { CreateGroupInvitationCommand } from "./createGroupInvitation.command.js";

export const groupInvitationLifetimeMilliseconds = 7 * 24 * 60 * 60 * 1000;

export function createGroupInvitationHandler(context: HandlerContext): Handler<CreateGroupInvitationCommand, GroupInvitationView> {
  return async ({ actorId, conversationId, inviteeId }) => {
    if (actorId === inviteeId) throw conflict("CANNOT_INVITE_SELF", "You cannot invite yourself to a group.");
    const access = await requireConversationMember(context.database.client, conversationId, actorId);
    if (access.conversation.kind !== "group") throw forbidden("NOT_A_GROUP", "Membership invitations are only available for groups.");
    requireGroupAdmin(access);
    if (access.conversation.members.some((member) => member.accountId === inviteeId)) {
      throw conflict("ALREADY_GROUP_MEMBER", "That person is already a member of this group.");
    }
    if (!(await context.directory.findUserSummaries([inviteeId])).has(inviteeId)) throw notFound("USER_NOT_FOUND", "That account could not be found.");
    if (await blockRepository.hasBlockedPairWithAny(context.database.client, inviteeId, access.conversation.members.map((member) => member.accountId))) {
      throw forbidden("GROUP_INVITATION_BLOCKED", "This invitation cannot be sent because one of the accounts has blocked the other.");
    }

    const now = context.clock.now();
    const expiresAt = new Date(now.getTime() + groupInvitationLifetimeMilliseconds);
    let row;
    try {
      row = await context.database.transaction(async (transaction) => {
        await groupInvitationRepository.updatePendingForPair(transaction, conversationId, inviteeId, now);
        const existing = await groupInvitationRepository.findPair(transaction, conversationId, inviteeId);
        if (existing?.status === "pending") return existing;
        if (existing?.status === "accepted") throw conflict("GROUP_INVITATION_ALREADY_ACCEPTED", "This person has accepted; secure key handoff is still required before membership can begin.");
        const openInvitations = await groupInvitationRepository.countOpenForConversation(transaction, conversationId, now);
        if (existing === null && access.conversation.members.length + openInvitations >= maximumGroupMembers) {
          throw conflict("GROUP_FULL", `A group can have up to ${maximumGroupMembers} members and pending invitees.`);
        }
        const invitation = existing === null
          ? await groupInvitationRepository.create(transaction, { conversationId, inviterId: actorId, inviteeId, status: "pending", createdAt: now, expiresAt })
          : await groupInvitationRepository.update(transaction, existing.id, { inviterId: actorId, status: "pending", createdAt: now, expiresAt, respondedAt: null });
        await appendDomainEventsToOutbox(transaction, [{
          eventType: socialEventTypes.groupInvitationCreated,
          subject: invitation.id,
          occurredAt: now,
          data: { invitationId: invitation.id, conversationId, inviterId: actorId, inviteeId, expiresAt: expiresAt.toISOString() },
        }]);
        return invitation;
      });
    } catch (error) {
      if (!isUniqueConstraintViolationError(error)) throw error;
      const concurrentlyCreated = await groupInvitationRepository.findPair(context.database.client, conversationId, inviteeId);
      if (concurrentlyCreated === null || concurrentlyCreated.status !== "pending") throw error;
      row = concurrentlyCreated;
    }
    return (await toGroupInvitationViews(context, [row], actorId))[0]!;
  };
}
