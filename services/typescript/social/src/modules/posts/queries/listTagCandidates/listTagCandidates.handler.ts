import type { UserSummary } from "../../../../interfaces/identityDirectory.interface.js";
import type { Handler, HandlerContext } from "../../../../types/handlerContext.type.js";
import { decodeOffsetCursor, encodeOffsetCursor } from "../../../../utils/cursor.util.js";
import { blockRepository } from "../../../blocks/repositories/block.repository.js";
import { postTagRepository } from "../../repositories/postTag.repository.js";
import type { ListTagCandidatesQuery } from "./listTagCandidates.query.js";

const taggingDisabledReason = "Doesn't allow tags";

export interface TagCandidateView {
  readonly user: UserSummary;
  readonly canTag: boolean;
  readonly unavailableReason: string | null;
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
    const candidates = found.filter((user) => user.id !== viewerId);
    const candidateIds = candidates.map((user) => user.id);
    if (candidateIds.length === 0) return { data: [], candidates: [], nextCursor: null };
    const [statuses, blockedByViewer, blockersOfViewer, taggingDisabled] = await Promise.all([
      context.directory.findMentionTargetStatuses(candidateIds),
      blockRepository.blockedByViewer(context.database.client, viewerId, candidateIds),
      blockRepository.blockersOfViewer(context.database.client, viewerId, candidateIds),
      postTagRepository.taggingDisabledAmong(context.database.client, candidateIds),
    ]);
    // Keep existing account-status and mutual-block privacy filters. Only expose
    // the opt-out state for otherwise visible accounts, as the picker needs it
    // to render a disabled row without revealing any further account metadata.
    const visible = candidates.filter((user) =>
      statuses.get(user.id)?.status === "active" &&
      !blockedByViewer.has(user.id) &&
      !blockersOfViewer.has(user.id),
    );
    const offset = decodeOffsetCursor(cursor);
    const data = visible.slice(offset, offset + limit).map((user): TagCandidateView => {
      const canTag = !taggingDisabled.has(user.id);
      return { user, canTag, unavailableReason: canTag ? null : taggingDisabledReason };
    });
    return { data, candidates: data, nextCursor: visible.length > offset + limit ? encodeOffsetCursor(offset + limit) : null };
  };
}
