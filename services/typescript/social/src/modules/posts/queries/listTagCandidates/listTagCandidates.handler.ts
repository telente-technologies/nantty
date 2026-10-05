import type { UserSummary } from "../../../../interfaces/identityDirectory.interface.js";
import type { Handler, HandlerContext } from "../../../../types/handlerContext.type.js";
import { decodeOffsetCursor, encodeOffsetCursor } from "../../../../utils/cursor.util.js";
import { filterTaggableUserIds } from "../../services/postTagEligibility.service.js";
import type { ListTagCandidatesQuery } from "./listTagCandidates.query.js";

export interface TagCandidateView {
  readonly user: UserSummary;
  readonly canTag: true;
  readonly unavailableReason: null;
}

export interface TagCandidatesResponse {
  readonly data: readonly TagCandidateView[];
  readonly candidates: readonly TagCandidateView[];
  readonly nextCursor: string | null;
}

const searchPoolSize = 200;

export function createListTagCandidatesHandler(context: HandlerContext): Handler<ListTagCandidatesQuery, TagCandidatesResponse> {
  return async ({ viewerId, term, cursor, limit }) => {
    const needle = term.trim().replace(/^@/, "");
    if (needle === "") return { data: [], candidates: [], nextCursor: null };
    const found = await context.directory.searchUserSummaries(needle, searchPoolSize);
    const taggable = new Set(await filterTaggableUserIds(context, viewerId, found.map((user) => user.id)));
    const eligible = found.filter((user) => taggable.has(user.id));
    const offset = decodeOffsetCursor(cursor);
    const data = eligible.slice(offset, offset + limit).map((user): TagCandidateView => ({ user, canTag: true, unavailableReason: null }));
    return { data, candidates: data, nextCursor: eligible.length > offset + limit ? encodeOffsetCursor(offset + limit) : null };
  };
}
