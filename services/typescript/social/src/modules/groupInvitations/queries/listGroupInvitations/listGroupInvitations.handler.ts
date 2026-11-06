import type { Handler, HandlerContext } from "../../../../types/handlerContext.type.js";
import type { Page } from "../../../../types/pagination.type.js";
import { groupInvitationRepository } from "../../repositories/groupInvitation.repository.js";
import type { GroupInvitationView } from "../../models/groupInvitation.model.js";
import { toGroupInvitationViews } from "../../services/groupInvitationView.service.js";
import type { ListGroupInvitationsQuery } from "./listGroupInvitations.query.js";

export function createListGroupInvitationsHandler(context: HandlerContext): Handler<ListGroupInvitationsQuery, Page<GroupInvitationView>> {
  return async ({ accountId, direction, status, cursor, limit }) => {
    const now = context.clock.now();
    const db = context.database.client;
    await groupInvitationRepository.expirePendingForAccount(db, accountId, now);
    const rows = await groupInvitationRepository.pageForAccount(db, accountId, direction, status, limit, cursor);
    const hasMore = rows.length > limit;
    const pageRows = hasMore ? rows.slice(0, limit) : rows;
    return {
      data: await toGroupInvitationViews(context, pageRows, accountId),
      nextCursor: hasMore ? (pageRows.at(-1)?.id ?? null) : null,
    };
  };
}
