import { buildPageFromOverfetchedRows } from "../../../utils/cursor.util.js";
import type { Page } from "../../../types/pagination.type.js";
import type { HandlerContext } from "../../../types/handlerContext.type.js";
import type { ConnectionEntry } from "../models/follow.model.js";
import { followRepository } from "../repositories/follow.repository.js";
import { buildConnectionEntries } from "./connectionEntry.service.js";
import { assertViewerMaySeeConnections } from "./profileAccess.service.js";

export interface ConnectionListRequest {
  readonly viewerId: string | undefined;
  readonly ownerId: string;
  readonly searchTerm: string | undefined;
  readonly cursor: string | undefined;
  readonly limit: number;
  readonly direction: "followers" | "following";
}

const searchCandidateLimit = 200;

export async function listConnectionsRespectingPrivacy(context: HandlerContext, request: ConnectionListRequest): Promise<Page<ConnectionEntry>> {
  await assertViewerMaySeeConnections(context, request.viewerId, request.ownerId);
  const term = request.searchTerm?.trim() ?? "";
  const matchingIds = term === "" ? undefined : (await context.directory.searchUserSummaries(term, searchCandidateLimit)).map((summary) => summary.id);
  if (matchingIds !== undefined && matchingIds.length === 0) return { data: [], nextCursor: null };
  const db = context.database.client;
  const rows = request.direction === "followers"
    ? await followRepository.pageFollowers(db, request.ownerId, request.limit, request.cursor, matchingIds)
    : await followRepository.pageFollowing(db, request.ownerId, request.limit, request.cursor, matchingIds);
  const page = buildPageFromOverfetchedRows(rows, request.limit);
  const accountIds = page.data.map((row) => (request.direction === "followers" ? row.followerId : row.followeeId));
  return { data: await buildConnectionEntries(context, request.viewerId, accountIds), nextCursor: page.nextCursor };
}
