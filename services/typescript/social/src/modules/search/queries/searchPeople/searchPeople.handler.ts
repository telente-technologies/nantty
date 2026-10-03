import type { Handler, HandlerContext } from "../../../../types/handlerContext.type.js";
import type { Page } from "../../../../types/pagination.type.js";
import { decodeOffsetCursor, encodeOffsetCursor } from "../../../../utils/cursor.util.js";
import { blockRepository } from "../../../blocks/repositories/block.repository.js";
import type { ConnectionEntry } from "../../../follows/models/follow.model.js";
import { buildConnectionEntries } from "../../../follows/services/connectionEntry.service.js";
import type { SearchPeopleQuery } from "./searchPeople.query.js";

const candidatePool = 200;

export function createSearchPeopleHandler(context: HandlerContext): Handler<SearchPeopleQuery, Page<ConnectionEntry>> {
  return async ({ viewerId, term, cursor, limit }) => {
    const needle = term.trim().replace(/^@/, "");
    if (needle === "") return { data: [], nextCursor: null };
    const found = await context.directory.searchUserSummaries(needle, candidatePool);
    const ids = found.map((user) => user.id).filter((id) => id !== viewerId);
    const [statuses, hidden] = await Promise.all([
      context.directory.findMentionTargetStatuses(ids),
      viewerId === undefined ? new Set<string>() : blockRepository.everyoneBlockedByOrBlocking(context.database.client, viewerId),
    ]);
    const lower = needle.toLowerCase();
    const eligible = ids
      .filter((id) => statuses.get(id)?.status === "active" && !hidden.has(id))
      .sort((left, right) => rank(found.find((user) => user.id === left)?.username, lower) - rank(found.find((user) => user.id === right)?.username, lower));
    const offset = decodeOffsetCursor(cursor);
    const pageIds = eligible.slice(offset, offset + limit);
    const next = offset + limit;
    return { data: await buildConnectionEntries(context, viewerId, pageIds), nextCursor: next < eligible.length ? encodeOffsetCursor(next) : null };
  };
}

function rank(username: string | undefined, needle: string): number {
  const name = (username ?? "").toLowerCase();
  return name === needle ? 0 : name.startsWith(needle) ? 1 : 2;
}
