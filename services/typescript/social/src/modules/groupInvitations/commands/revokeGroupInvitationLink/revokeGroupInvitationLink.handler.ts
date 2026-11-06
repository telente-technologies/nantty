import { forbidden, notFound } from "../../../../errors/social.error.js";
import type { Handler, HandlerContext } from "../../../../types/handlerContext.type.js";
import { requireConversationMember, requireGroupAdmin } from "../../../conversations/services/conversationAccess.service.js";
import type { GroupInvitationLinkRevokedView } from "../../models/groupInvitationLink.model.js";
import { groupInvitationLinkRepository } from "../../repositories/groupInvitationLink.repository.js";
import type { RevokeGroupInvitationLinkCommand } from "./revokeGroupInvitationLink.command.js";

export function revokeGroupInvitationLinkHandler(context: HandlerContext): Handler<RevokeGroupInvitationLinkCommand, GroupInvitationLinkRevokedView> {
  return async ({ actorId, conversationId, linkId }) => {
    const access = await requireConversationMember(context.database.client, conversationId, actorId);
    if (access.conversation.kind !== "group") throw forbidden("NOT_A_GROUP", "Shareable membership links are only available for groups.");
    requireGroupAdmin(access);
    const row = await groupInvitationLinkRepository.findByIdForConversation(context.database.client, linkId, conversationId);
    if (row === null) throw notFound("GROUP_INVITATION_LINK_NOT_FOUND", "Group invitation link not found.");
    if (row.revokedAt !== null) return { id: row.id, conversationId, revokedAt: row.revokedAt.toISOString() };
    const revokedAt = context.clock.now();
    await groupInvitationLinkRepository.revoke(context.database.client, linkId, conversationId, revokedAt);
    const updated = await groupInvitationLinkRepository.findByIdForConversation(context.database.client, linkId, conversationId);
    if (updated === null) throw notFound("GROUP_INVITATION_LINK_NOT_FOUND", "Group invitation link not found.");
    return { id: updated.id, conversationId, revokedAt: updated.revokedAt?.toISOString() ?? revokedAt.toISOString() };
  };
}
