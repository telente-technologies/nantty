import { notFound } from "../../../../errors/social.error.js";
import type { Handler, HandlerContext } from "../../../../types/handlerContext.type.js";
import type { ChannelInvitationLinkPreviewView } from "../../models/channelInvitation.model.js";
import { channelInvitationLinkRepository } from "../../repositories/channelInvitationLink.repository.js";
import { hashChannelInvitationLinkToken } from "../../services/channelInvitationLinkToken.service.js";
import type { PreviewChannelInvitationLinkCommand } from "./previewChannelInvitationLink.command.js";

export function previewChannelInvitationLinkHandler(context: HandlerContext): Handler<PreviewChannelInvitationLinkCommand, ChannelInvitationLinkPreviewView> {
  return async ({ token }) => {
    const row = await channelInvitationLinkRepository.findActiveByTokenHash(context.database.client, hashChannelInvitationLinkToken(token), context.clock.now());
    if (row === null) throw notFound("CHANNEL_INVITATION_LINK_NOT_FOUND", "This channel invitation link is unavailable.");
    return {
      channel: { title: row.conversation.title, subscriberCount: row.conversation.members.length },
      expiresAt: row.expiresAt.toISOString(),
    };
  };
}
