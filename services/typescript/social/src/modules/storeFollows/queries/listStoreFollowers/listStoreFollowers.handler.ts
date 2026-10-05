import type { Handler, HandlerContext } from "../../../../types/handlerContext.type.js";
import type { Page } from "../../../../types/pagination.type.js";
import type { ConnectionEntry } from "../../../follows/models/follow.model.js";
import { buildConnectionEntries } from "../../../follows/services/connectionEntry.service.js";
import { storeFollowRepository } from "../../repositories/storeFollow.repository.js";
import type { ListStoreFollowersQuery } from "./listStoreFollowers.query.js";

export function createListStoreFollowersHandler(context: HandlerContext): Handler<ListStoreFollowersQuery, Page<ConnectionEntry>> {
  return async ({ viewerId, storeId, cursor, limit }) => {
    const rows = await storeFollowRepository.pageFollowers(context.database.client, storeId, limit, cursor);
    const page = rows.slice(0, limit);
    const privateIds = await context.directory.findPrivateAccountIds(page.map((row) => row.followerId));
    const visible = page.filter((row) => !privateIds.has(row.followerId) || row.followerId === viewerId);
    return { data: await buildConnectionEntries(context, viewerId, visible.map((row) => row.followerId)), nextCursor: rows.length > limit ? (page.at(-1)?.followerId ?? null) : null };
  };
}
