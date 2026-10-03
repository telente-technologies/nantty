import type { Handler, HandlerContext } from "../../../../types/handlerContext.type.js";
import type { Page } from "../../../../types/pagination.type.js";
import { buildPageFromOverfetchedRows } from "../../../../utils/cursor.util.js";
import type { ConnectionEntry } from "../../../follows/models/follow.model.js";
import { buildConnectionEntries } from "../../../follows/services/connectionEntry.service.js";
import { blockRepository } from "../../repositories/block.repository.js";
import type { ListBlockedUsersQuery } from "./listBlockedUsers.query.js";

export function createListBlockedUsersHandler(context: HandlerContext): Handler<ListBlockedUsersQuery, Page<ConnectionEntry>> {
  return async ({ viewerId, cursor, limit }) => {
    const rows = await blockRepository.pageBlocked(context.database.client, viewerId, limit, cursor);
    const page = buildPageFromOverfetchedRows(rows.map((row) => ({ id: row.blockedId })), limit);
    return { data: await buildConnectionEntries(context, viewerId, page.data.map((row) => row.id)), nextCursor: page.nextCursor };
  };
}
