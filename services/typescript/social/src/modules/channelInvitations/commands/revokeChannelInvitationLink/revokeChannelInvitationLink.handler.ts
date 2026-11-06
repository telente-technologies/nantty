import { notFound } from "../../../../errors/social.error.js";
import type { Handler, HandlerContext } from "../../../../types/handlerContext.type.js";
import { requireConversationMember } from "../../../conversations/services/conversationAccess.service.js";
import type { ChannelInvitationLinkManagementView } from "../../models/channelInvitation.model.js";
import { channelInvitationLinkRepository } from "../../repositories/channelInvitationLink.repository.js";
import { requireChannelAdmin } from "../../services/channelInvitationAccess.service.js";
import type { RevokeChannelInvitationLinkCommand } from "./revokeChannelInvitationLink.command.js";

export function revokeChannelInvitationLinkHandler(context: HandlerContext): Handler<RevokeChannelInvitationLinkCommand, ChannelInvitationLinkManagementView> {
  return async ({ actorId, channelId, linkId }) => {
    const access = await requireConversationMember(context.database.client, channelId, actorId);
    requireChannelAdmin(access);
    const link = await channelInvitationLinkRepository.findByIdForChannel(context.database.client, linkId, channelId);
    if (link === null) throw notFound("CHANNEL_INVITATION_LINK_NOT_FOUND", "Channel invitation link not found.");
    if (link.revokedAt === null) await channelInvitationLinkRepository.revoke(context.database.client, linkId, channelId, context.clock.now());
    const updated = await channelInvitationLinkRepository.findByIdForChannel(context.database.client, linkId, channelId);
    if (updated === null) throw notFound("CHANNEL_INVITATION_LINK_NOT_FOUND", "Channel invitation link not found.");
    return {
      id: updated.id,
      channelId: updated.conversationId,
      createdAt: updated.createdAt.toISOString(),
      expiresAt: updated.expiresAt.toISOString(),
      revokedAt: updated.revokedAt?.toISOString() ?? null,
    };
  };
}
