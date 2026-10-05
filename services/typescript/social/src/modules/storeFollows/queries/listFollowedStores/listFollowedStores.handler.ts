import type { Handler, HandlerContext } from "../../../../types/handlerContext.type.js";
import type { Page } from "../../../../types/pagination.type.js";
import { assertViewerMaySeeConnections } from "../../../follows/services/profileAccess.service.js";
import type { FollowedStoreEntry } from "../../models/storeFollow.model.js";
import { storeFollowRepository } from "../../repositories/storeFollow.repository.js";
import type { ListFollowedStoresQuery } from "./listFollowedStores.query.js";

export function createListFollowedStoresHandler(context: HandlerContext): Handler<ListFollowedStoresQuery, Page<FollowedStoreEntry>> {
  return async ({ viewerId, ownerId, cursor, limit }) => {
    await assertViewerMaySeeConnections(context, viewerId, ownerId);
    const db = context.database.client;
    const rows = await storeFollowRepository.pageFollowedStores(db, ownerId, limit, cursor);
    const page = rows.slice(0, limit);
    const viewerFollows = viewerId === undefined ? new Set<string>() : new Set((await db.storeFollow.findMany({ where: { followerId: viewerId, storeId: { in: page.map((row) => row.storeId) } }, select: { storeId: true } })).map((row) => row.storeId));
    const cards = await Promise.all(page.map(async (row) => [row, await context.shareCards?.resolve("store", row.storeId, viewerId ?? ownerId).catch(() => null)] as const));
    const data = cards.flatMap(([row, card]): FollowedStoreEntry[] => (card?.availability === "unavailable" ? [] : [{
      id: row.storeId, kind: "store", name: card?.title ?? "", username: "", avatarUrl: card?.imageUrl ?? null, verified: false, isCreator: false,
      isFollowing: viewerFollows.has(row.storeId), followedAt: row.createdAt.toISOString(),
    }]));
    return { data, nextCursor: rows.length > limit ? (page.at(-1)?.storeId ?? null) : null };
  };
}
