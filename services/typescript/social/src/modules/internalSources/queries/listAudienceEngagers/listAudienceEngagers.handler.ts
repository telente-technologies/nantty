import type { Handler, HandlerContext } from "../../../../types/handlerContext.type.js";
import type { AudienceMember, CursorPage } from "../../models/internalSources.model.js";
import { keepConsentingMembers } from "../../services/audienceConsent.service.js";
import type { ListAudienceEngagersQuery } from "./listAudienceEngagers.query.js";

interface EngagerTally {
  readonly accountId: string;
  readonly interactions: number;
  readonly lastActiveAt: Date;
}

export function mergeEngagerTallies(groups: readonly (readonly EngagerTally[])[], limit: number): { readonly page: EngagerTally[]; readonly hasMore: boolean } {
  const merged = new Map<string, EngagerTally>();
  for (const group of groups) {
    for (const tally of group) {
      const previous = merged.get(tally.accountId);
      merged.set(tally.accountId, previous === undefined ? tally : {
        accountId: tally.accountId,
        interactions: previous.interactions + tally.interactions,
        lastActiveAt: previous.lastActiveAt > tally.lastActiveAt ? previous.lastActiveAt : tally.lastActiveAt,
      });
    }
  }
  const sorted = [...merged.values()].sort((left, right) => (left.accountId < right.accountId ? -1 : 1));
  return { page: sorted.slice(0, limit), hasMore: sorted.length > limit };
}

export function createListAudienceEngagersHandler(context: HandlerContext): Handler<ListAudienceEngagersQuery, CursorPage<AudienceMember>> {
  return async ({ accountId, source, since, cursor, limit }) => {
    const db = context.database.client;
    const afterCursor = cursor === undefined ? {} : { gt: cursor };
    const tallies: EngagerTally[][] = [];
    const toTallies = (rows: readonly { readonly _count: { readonly _all: number }; readonly _max: { readonly createdAt: Date | null } }[], idOf: (index: number) => string) =>
      rows.map((row, index) => ({ accountId: idOf(index), interactions: row._count._all, lastActiveAt: row._max.createdAt ?? since }));
    if (source === "messaged") {
      const rows = await db.message.groupBy({
        by: ["senderId"], where: { senderId: { not: accountId, ...afterCursor }, createdAt: { gte: since }, conversation: { members: { some: { accountId } } } },
        _count: { _all: true }, _max: { createdAt: true }, orderBy: { senderId: "asc" }, take: limit + 1,
      });
      tallies.push(toTallies(rows, (index) => rows[index]?.senderId ?? ""));
    } else {
      const kinds = source === "clips_watched" ? (["clip"] as const) : (["post", "clip"] as const);
      const postFilter = { authorId: accountId, kind: { in: [...kinds] } };
      const likes = await db.postLike.groupBy({
        by: ["userId"], where: { userId: { not: accountId, ...afterCursor }, createdAt: { gte: since }, post: postFilter },
        _count: { _all: true }, _max: { createdAt: true }, orderBy: { userId: "asc" }, take: limit + 1,
      });
      const comments = await db.comment.groupBy({
        by: ["authorId"], where: { authorId: { not: accountId, ...afterCursor }, createdAt: { gte: since }, deletedAt: null, hiddenAt: null, post: postFilter },
        _count: { _all: true }, _max: { createdAt: true }, orderBy: { authorId: "asc" }, take: limit + 1,
      });
      tallies.push(toTallies(likes, (index) => likes[index]?.userId ?? ""), toTallies(comments, (index) => comments[index]?.authorId ?? ""));
    }
    const { page, hasMore } = mergeEngagerTallies(tallies, limit);
    const candidates = page.map((tally) => ({ accountId: tally.accountId, interactions: tally.interactions, lastActiveAt: tally.lastActiveAt.toISOString() }));
    return keepConsentingMembers(context, candidates, hasMore ? (page[page.length - 1]?.accountId ?? null) : null);
  };
}
