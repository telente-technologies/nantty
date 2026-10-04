import type { Handler, HandlerContext } from "../../../../types/handlerContext.type.js";
import type { AudienceMember, CursorPage } from "../../models/internalSources.model.js";
import { keepConsentingMembers } from "../../services/audienceConsent.service.js";
import type { ListAudienceFollowersQuery } from "./listAudienceFollowers.query.js";

export function createListAudienceFollowersHandler(context: HandlerContext): Handler<ListAudienceFollowersQuery, CursorPage<AudienceMember>> {
  return async ({ accountId, cursor, limit }) => {
    const rows = await context.database.client.follow.findMany({
      where: { followeeId: accountId, state: "accepted" },
      orderBy: { id: "asc" },
      take: limit + 1,
      select: { id: true, followerId: true, createdAt: true },
      ...(cursor === undefined ? {} : { cursor: { id: cursor }, skip: 1 }),
    });
    const page = rows.slice(0, limit);
    const candidates = page.map((row) => ({ accountId: row.followerId, lastActiveAt: row.createdAt.toISOString(), interactions: 1 }));
    return keepConsentingMembers(context, candidates, rows.length > limit ? (page[page.length - 1]?.id ?? null) : null);
  };
}
