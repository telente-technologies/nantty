import type { Handler, HandlerContext } from "../../../../types/handlerContext.type.js";
import type { Page } from "../../../../types/pagination.type.js";
import { buildPageFromOverfetchedRows } from "../../../../utils/cursor.util.js";
import type { FollowRequestView } from "../../models/follow.model.js";
import { followRepository } from "../../repositories/follow.repository.js";
import type { ListFollowRequestsQuery } from "./listFollowRequests.query.js";

export function createListFollowRequestsHandler(context: HandlerContext): Handler<ListFollowRequestsQuery, Page<FollowRequestView>> {
  return async ({ followeeId, cursor, limit }) => {
    const rows = await followRepository.pageIncomingRequests(context.database.client, followeeId, limit, cursor);
    const page = buildPageFromOverfetchedRows(rows, limit);
    const summaries = await context.directory.findUserSummaries(page.data.map((row) => row.followerId));
    const data = page.data.flatMap((row) => {
      const requester = summaries.get(row.followerId);
      return requester === undefined ? [] : [{ id: row.id, requester, createdAt: row.createdAt.toISOString() }];
    });
    return { data, nextCursor: page.nextCursor };
  };
}
