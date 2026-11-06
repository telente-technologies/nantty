import { forbidden } from "../../../../errors/social.error.js";
import type { Handler, HandlerContext } from "../../../../types/handlerContext.type.js";
import { requireConversationMember } from "../../../conversations/services/conversationAccess.service.js";
import type { ChannelInvitationLinkCreatedView } from "../../models/channelInvitation.model.js";
import { channelInvitationLinkRepository } from "../../repositories/channelInvitationLink.repository.js";
import { requireChannelAdmin } from "../../services/channelInvitationAccess.service.js";
import { createChannelInvitationLinkToken, hashChannelInvitationLinkToken } from "../../services/channelInvitationLinkToken.service.js";
import type { CreateChannelInvitationLinkCommand } from "./createChannelInvitationLink.command.js";

export function createChannelInvitationLinkHandler(context: HandlerContext): Handler<CreateChannelInvitationLinkCommand, ChannelInvitationLinkCreatedView> {
  return async ({ actorId, channelId, expiresInHours }) => {
    const access = await requireConversationMember(context.database.client, channelId, actorId);
    if (access.conversation.kind !== "channel") throw forbidden("NOT_A_CHANNEL", "Invitation links are only available for channels.");
    requireChannelAdmin(access);
    const token = createChannelInvitationLinkToken();
    const now = context.clock.now();
    const expiresAt = new Date(now.getTime() + expiresInHours * 60 * 60 * 1000);
    const row = await channelInvitationLinkRepository.create(context.database.client, {
      conversationId: channelId,
      createdById: actorId,
      tokenHash: hashChannelInvitationLinkToken(token),
      createdAt: now,
      expiresAt,
    });
    return { id: row.id, channelId: row.conversationId, token, expiresAt: row.expiresAt.toISOString() };
  };
}
