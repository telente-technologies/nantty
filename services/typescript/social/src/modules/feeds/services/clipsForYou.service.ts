import type { Prisma } from "../../../generated/prisma/client.js";
import { badRequest } from "../../../errors/social.error.js";
import type { RankedCandidate, RankingExplanation } from "../../../interfaces/feedRanker.interface.js";
import type { HandlerContext } from "../../../types/handlerContext.type.js";
import type { Page } from "../../../types/pagination.type.js";
import { blockRepository } from "../../blocks/repositories/block.repository.js";
import type { PostView } from "../../posts/models/post.model.js";
import { buildPostViews } from "../../posts/services/postView.service.js";
import { isPostWithheldFromViewer, resolveCurrentViewerContentPolicy } from "../../posts/services/sensitiveContent.service.js";
import { feedRepository } from "../repositories/feed.repository.js";
import { feedRankSnapshotLifetimeMs, feedRankSnapshotRepository } from "../repositories/feedRankSnapshot.repository.js";
import { attachRankingDisclosure, rankFeedCandidates } from "./rankedFeed.service.js";

export const clipsSnapshotSurface = "clips_for_you";
const maximumSnapshotItems = 500;

export interface ClipsForYouRequest {
  readonly viewerId: string | undefined;
  readonly personalized: boolean;
  readonly cursor: string | undefined;
  readonly limit: number;
}

export interface SnapshotCursor {
  readonly snapshotId: string;
  readonly offset: number;
}

interface StoredDisclosure {
  readonly e: readonly RankingExplanation[];
  readonly b: number;
}

export function encodeSnapshotCursor(cursor: SnapshotCursor): string {
  return Buffer.from(JSON.stringify({ s: cursor.snapshotId, o: cursor.offset })).toString("base64url");
}

export function decodeSnapshotCursor(raw: string): SnapshotCursor | null {
  try {
    const parsed = JSON.parse(Buffer.from(raw, "base64url").toString("utf8")) as { s?: unknown; o?: unknown };
    if (typeof parsed.s !== "string" || !/^[0-9a-f-]{36}$/i.test(parsed.s) || typeof parsed.o !== "number" || !Number.isInteger(parsed.o) || parsed.o < 0) return null;
    return { snapshotId: parsed.s, offset: parsed.o };
  } catch {
    return null;
  }
}

export function toStoredDisclosures(ordered: readonly RankedCandidate[]): Prisma.InputJsonObject {
  return Object.fromEntries(ordered.map((candidate) => [candidate.postId, { e: (candidate.explanations ?? []).map((entry) => ({ code: entry.code, label: entry.label, ...(entry.detail == null ? {} : { detail: entry.detail }) })), b: candidate.boostMultiplier ?? 1 }]));
}

type Disclosure = Pick<RankedCandidate, "explanations" | "boostMultiplier">;

function readDisclosures(stored: Prisma.JsonValue, ids: readonly string[]): Map<string, Disclosure> {
  const record = stored !== null && typeof stored === "object" && !Array.isArray(stored) ? (stored as Record<string, StoredDisclosure | undefined>) : {};
  return new Map(ids.flatMap((id) => {
    const entry = record[id];
    const disclosure: Disclosure = { explanations: Array.isArray(entry?.e) ? entry.e : [], boostMultiplier: typeof entry?.b === "number" ? entry.b : 1 };
    return entry === undefined ? [] : [[id, disclosure] as const];
  }));
}

async function openSnapshot(context: HandlerContext, request: ClipsForYouRequest) {
  const db = context.database.client;
  if (request.cursor === undefined) {
    const { ordered } = await rankFeedCandidates(context, { viewerId: request.viewerId, personalized: request.personalized, kinds: ["clip"] }, { ranker: context.clipRanker ?? context.ranker, withWatchTotals: true });
    const kept = ordered.slice(0, maximumSnapshotItems);
    const snapshot = await feedRankSnapshotRepository.create(db, { viewerId: request.viewerId, surface: clipsSnapshotSurface, itemIds: kept.map((candidate) => candidate.postId), disclosures: toStoredDisclosures(kept), createdAt: context.clock.now() });
    return { snapshot, offset: 0 };
  }
  const decoded = decodeSnapshotCursor(request.cursor);
  const snapshot = decoded === null ? null : await feedRankSnapshotRepository.find(db, decoded.snapshotId);
  const expired = snapshot === null || snapshot.createdAt.getTime() < context.clock.now().getTime() - feedRankSnapshotLifetimeMs;
  if (decoded === null || expired || snapshot.surface !== clipsSnapshotSurface || snapshot.viewerId !== (request.viewerId ?? null)) throw badRequest("CURSOR_EXPIRED", "This list changed. Refresh to see the latest clips.");
  return { snapshot, offset: decoded.offset };
}

export async function loadClipsForYouPage(context: HandlerContext, request: ClipsForYouRequest): Promise<Page<PostView>> {
  const db = context.database.client;
  const { snapshot, offset } = await openSnapshot(context, request);
  const pageIds = snapshot.itemIds.slice(offset, offset + request.limit);
  const [rows, policy, hiddenAuthors] = await Promise.all([
    pageIds.length === 0 ? [] : feedRepository.findRankedRows(db, pageIds, ["clip"]),
    resolveCurrentViewerContentPolicy(context, request.viewerId),
    request.viewerId === undefined ? new Set<string>() : blockRepository.everyoneBlockedByOrBlocking(db, request.viewerId),
  ]);
  const authorIds = [...new Set(rows.map((row) => row.authorId))];
  const [privateAuthors, suspended] = await Promise.all([
    authorIds.length === 0 ? new Set<string>() : context.directory.findPrivateAccountIds(authorIds),
    authorIds.length === 0 ? new Set<string>() : (context.authorRanking?.findSuspendedAccountIds(authorIds) ?? Promise.resolve(new Set<string>())),
  ]);
  const byId = new Map(rows.filter((row) => !hiddenAuthors.has(row.authorId) && !privateAuthors.has(row.authorId) && !suspended.has(row.authorId) && !isPostWithheldFromViewer(row, policy)).map((row) => [row.id, row]));
  const pageRows = pageIds.flatMap((id) => byId.get(id) ?? []);
  const views = await buildPostViews(context, request.viewerId, pageRows, policy);
  const nextOffset = offset + pageIds.length;
  return {
    data: attachRankingDisclosure(views, readDisclosures(snapshot.disclosures, pageIds)),
    nextCursor: nextOffset < snapshot.itemIds.length ? encodeSnapshotCursor({ snapshotId: snapshot.id, offset: nextOffset }) : null,
  };
}
