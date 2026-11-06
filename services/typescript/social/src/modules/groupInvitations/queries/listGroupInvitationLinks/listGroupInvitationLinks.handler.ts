import { badRequest, forbidden } from "../../../../errors/social.error.js";
import type { Handler, HandlerContext } from "../../../../types/handlerContext.type.js";
import type { Page } from "../../../../types/pagination.type.js";
import { requireConversationMember, requireGroupAdmin } from "../../../conversations/services/conversationAccess.service.js";
import type { GroupInvitationLinkManagementView } from "../../models/groupInvitationLink.model.js";
import { groupInvitationLinkRepository } from "../../repositories/groupInvitationLink.repository.js";
import type { ListGroupInvitationLinksQuery } from "./listGroupInvitationLinks.query.js";

export function listGroupInvitationLinksHandler(context: HandlerContext): Handler<ListGroupInvitationLinksQuery, Page<GroupInvitationLinkManagementView>> {
  return async ({ actorId, conversationId, cursor, limit }) => {
    const db = context.database.client;
    const access = await requireConversationMember(db, conversationId, actorId);
    if (access.conversation.kind !== "group") throw forbidden("NOT_A_GROUP", "Invitation links are only available for groups.");
    requireGroupAdmin(access);
    if (cursor !== undefined && await groupInvitationLinkRepository.findCursorInConversation(db, cursor, conversationId) === null) {
      throw badRequest("INVALID_GROUP_INVITATION_LINK_CURSOR", "The invitation-link cursor is not in this group.");
    }
    // Retain expired and revoked rows so admins can still manage shared links after expiry or navigation.
    const rows = await groupInvitationLinkRepository.pageForConversation(db, conversationId, limit, cursor);
    const hasMore = rows.length > limit;
    const data = (hasMore ? rows.slice(0, limit) : rows).map((row) => ({
      id: row.id,
      conversationId: row.conversationId,
      createdAt: row.createdAt.toISOString(),
      expiresAt: row.expiresAt.toISOString(),
      revokedAt: row.revokedAt?.toISOString() ?? null,
    }));
    return { data, nextCursor: hasMore ? (data.at(-1)?.id ?? null) : null };
  };
}
