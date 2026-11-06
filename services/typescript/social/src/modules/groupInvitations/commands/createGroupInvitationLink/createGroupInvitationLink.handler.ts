import type { Handler, HandlerContext } from "../../../../types/handlerContext.type.js";
import { forbidden } from "../../../../errors/social.error.js";
import { requireConversationMember, requireGroupAdmin } from "../../../conversations/services/conversationAccess.service.js";
import type { GroupInvitationLinkCreatedView } from "../../models/groupInvitationLink.model.js";
import { groupInvitationLinkRepository } from "../../repositories/groupInvitationLink.repository.js";
import { createGroupInvitationLinkToken, hashGroupInvitationLinkToken } from "../../services/groupInvitationLinkToken.service.js";
import type { CreateGroupInvitationLinkCommand } from "./createGroupInvitationLink.command.js";

export function createGroupInvitationLinkHandler(context: HandlerContext): Handler<CreateGroupInvitationLinkCommand, GroupInvitationLinkCreatedView> {
  return async ({ actorId, conversationId, expiresInHours }) => {
    const access = await requireConversationMember(context.database.client, conversationId, actorId);
    if (access.conversation.kind !== "group") throw forbidden("NOT_A_GROUP", "Shareable membership links are only available for groups.");
    requireGroupAdmin(access);
    const token = createGroupInvitationLinkToken();
    const now = context.clock.now();
    const expiresAt = new Date(now.getTime() + expiresInHours * 60 * 60 * 1000);
    const row = await groupInvitationLinkRepository.create(context.database.client, {
      conversationId, createdById: actorId, tokenHash: hashGroupInvitationLinkToken(token), createdAt: now, expiresAt,
    });
    return { id: row.id, conversationId: row.conversationId, token, expiresAt: row.expiresAt.toISOString() };
  };
}
