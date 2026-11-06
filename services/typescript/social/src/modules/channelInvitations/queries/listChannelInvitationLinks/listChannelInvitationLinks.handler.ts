import { badRequest } from "../../../../errors/social.error.js";
import type { Handler, HandlerContext } from "../../../../types/handlerContext.type.js";
import type { Page } from "../../../../types/pagination.type.js";
import { requireConversationMember } from "../../../conversations/services/conversationAccess.service.js";
import type { ChannelInvitationLinkManagementView } from "../../models/channelInvitation.model.js";
import { channelInvitationLinkRepository } from "../../repositories/channelInvitationLink.repository.js";
import { requireChannelAdmin } from "../../services/channelInvitationAccess.service.js";
import type { ListChannelInvitationLinksQuery } from "./listChannelInvitationLinks.query.js";

export function listChannelInvitationLinksHandler(context: HandlerContext): Handler<ListChannelInvitationLinksQuery, Page<ChannelInvitationLinkManagementView>> {
  return async ({ actorId, channelId, cursor, limit }) => {
    const db = context.database.client;
    const access = await requireConversationMember(db, channelId, actorId);
    requireChannelAdmin(access);
    if (cursor !== undefined && await channelInvitationLinkRepository.findCursorInChannel(db, cursor, channelId) === null) {
      throw badRequest("INVALID_CHANNEL_INVITATION_LINK_CURSOR", "The invitation-link cursor is not in this channel.");
    }
    const rows = await channelInvitationLinkRepository.pageForChannel(db, channelId, limit, cursor);
    const hasMore = rows.length > limit;
    const data = (hasMore ? rows.slice(0, limit) : rows).map((row) => ({
      id: row.id,
      channelId: row.conversationId,
      createdAt: row.createdAt.toISOString(),
      expiresAt: row.expiresAt.toISOString(),
      revokedAt: row.revokedAt?.toISOString() ?? null,
    }));
    return { data, nextCursor: hasMore ? (data.at(-1)?.id ?? null) : null };
  };
}
