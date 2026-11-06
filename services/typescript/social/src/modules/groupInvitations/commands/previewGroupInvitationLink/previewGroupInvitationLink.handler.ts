import { notFound } from "../../../../errors/social.error.js";
import type { Handler, HandlerContext } from "../../../../types/handlerContext.type.js";
import type { GroupInvitationLinkPreviewView } from "../../models/groupInvitationLink.model.js";
import { groupInvitationLinkRepository } from "../../repositories/groupInvitationLink.repository.js";
import { hashGroupInvitationLinkToken } from "../../services/groupInvitationLinkToken.service.js";
import type { PreviewGroupInvitationLinkCommand } from "./previewGroupInvitationLink.command.js";

export function previewGroupInvitationLinkHandler(context: HandlerContext): Handler<PreviewGroupInvitationLinkCommand, GroupInvitationLinkPreviewView> {
  return async ({ token }) => {
    const row = await groupInvitationLinkRepository.findActiveByTokenHash(context.database.client, hashGroupInvitationLinkToken(token), context.clock.now());
    if (row === null) throw notFound("GROUP_INVITATION_LINK_NOT_FOUND", "This group invitation link is unavailable.");
    return {
      group: { title: row.conversation.title, memberCount: row.conversation.members.length },
      expiresAt: row.expiresAt.toISOString(),
    };
  };
}
