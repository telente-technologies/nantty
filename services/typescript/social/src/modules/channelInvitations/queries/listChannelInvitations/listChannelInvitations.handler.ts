import { badRequest } from "../../../../errors/social.error.js";
import type { Handler, HandlerContext } from "../../../../types/handlerContext.type.js";
import type { Page } from "../../../../types/pagination.type.js";
import type { ChannelInvitationView } from "../../models/channelInvitation.model.js";
import { channelInvitationRepository } from "../../repositories/channelInvitation.repository.js";
import { toChannelInvitationView } from "../../services/channelInvitationView.service.js";
import type { ListChannelInvitationsQuery } from "./listChannelInvitations.query.js";

export function listChannelInvitationsHandler(context: HandlerContext): Handler<ListChannelInvitationsQuery, Page<ChannelInvitationView>> {
  return async ({ inviteeId, status, cursor, limit }) => {
    const db = context.database.client;
    if (status === "pending") await channelInvitationRepository.expirePendingForInvitee(db, inviteeId, context.clock.now());
    if (cursor !== undefined && await channelInvitationRepository.findCursorForInvitee(db, cursor, inviteeId) === null) {
      throw badRequest("INVALID_CHANNEL_INVITATION_CURSOR", "The invitation cursor is not in this account's channel invitations.");
    }
    const rows = await channelInvitationRepository.pageForInvitee(db, inviteeId, status, limit, cursor);
    const hasMore = rows.length > limit;
    const data = (hasMore ? rows.slice(0, limit) : rows).map(toChannelInvitationView);
    return { data, nextCursor: hasMore ? (data.at(-1)?.id ?? null) : null };
  };
}
