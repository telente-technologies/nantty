import { badRequest } from "../../../errors/social.error.js";
import type { HandlerContext } from "../../../types/handlerContext.type.js";
import { filterAuthorsVisibleToViewer } from "../../follows/services/profileAccess.service.js";
import type { CommentRow } from "../repositories/comment.repository.js";
import { commentRankingRepository, rankingCandidateLimit, rankSnapshotLifetimeMs, rankSnapshotReuseMs } from "../repositories/commentRanking.repository.js";
import type { QuoteThreadItem } from "../models/comment.model.js";
import { chooseConversationChain, maximumPreviewChainLength } from "./commentChain.service.js";
import { isQuoteSnapshotKey, loadQuoteItemsByIds, quoteIdFromSnapshotKey, rankableQuotesForViewer } from "./conversationQuotes.service.js";
import { decodeRankedCursor, encodeRankedCursor, rankConversationRoots, type RankedPageCursor } from "./commentRanking.service.js";

export type RankedEntry = { readonly type: "comment"; readonly id: string } | { readonly type: "quote"; readonly id: string };

export interface RankedRootsPage {
  readonly roots: readonly CommentRow[];
  readonly quotes: ReadonlyMap<string, QuoteThreadItem>;
  readonly order: readonly RankedEntry[];
  readonly nextCursor: string | null;
}

const commentKeysIn = (keys: readonly string[]) => keys.filter((key) => !isQuoteSnapshotKey(key));

interface ConversationPost {
  readonly id: string;
  readonly authorId: string;
}

async function keepVisibleAuthors(context: HandlerContext, viewerId: string | undefined, rows: readonly CommentRow[]): Promise<CommentRow[]> {
  const visible = await filterAuthorsVisibleToViewer(context, viewerId, rows.map((row) => row.authorId));
  return rows.filter((row) => visible.has(row.authorId));
}

async function createRankedSnapshot(context: HandlerContext, viewerId: string | undefined, post: ConversationPost) {
  const db = context.database.client;
  const now = context.clock.now();
  const reusable = await commentRankingRepository.findReusableSnapshot(db, post.id, viewerId, new Date(now.getTime() - rankSnapshotReuseMs));
  if (reusable !== null) return { snapshot: reusable, hasTail: (await commentRankingRepository.countRootsUpTo(db, post.id, viewerId, reusable.createdAt)) > commentKeysIn(reusable.commentIds).length };
  const [candidates, authorRepliedRootIds, quotes] = await Promise.all([
    commentRankingRepository.rankingCandidates(db, post.id, post.authorId, viewerId),
    commentRankingRepository.rootsWithAuthorReplies(db, post.id, post.authorId),
    rankableQuotesForViewer(context, viewerId, post),
  ]);
  const ranked = rankConversationRoots([...(await keepVisibleAuthors(context, viewerId, candidates)), ...quotes], { postAuthorId: post.authorId, authorRepliedRootIds, now });
  const snapshot = await commentRankingRepository.createSnapshot(db, { postId: post.id, viewerId, pinnedCommentId: ranked.find((row) => row.isPinned)?.id ?? null, commentIds: ranked.map((row) => row.id), createdAt: now });
  return { snapshot, hasTail: candidates.length >= rankingCandidateLimit };
}

export async function loadRankedRootsPage(context: HandlerContext, viewerId: string | undefined, post: ConversationPost, rawCursor: string | undefined, limit: number): Promise<RankedRootsPage> {
  const db = context.database.client;
  let cursor: RankedPageCursor;
  let snapshot;
  if (rawCursor === undefined) {
    const created = await createRankedSnapshot(context, viewerId, post);
    snapshot = created.snapshot;
    cursor = { snapshotId: snapshot.id, offset: 0, tailAfterId: null, hasTail: created.hasTail };
  } else {
    const decoded = decodeRankedCursor(rawCursor);
    const found = decoded === null ? null : await commentRankingRepository.findSnapshot(db, decoded.snapshotId);
    const expired = found === null || found.createdAt.getTime() <= context.clock.now().getTime() - rankSnapshotLifetimeMs;
    if (decoded === null || expired || found.postId !== post.id || found.viewerId !== (viewerId ?? null)) throw badRequest("CURSOR_EXPIRED", "This list changed. Refresh to see the latest comments.");
    snapshot = found;
    cursor = decoded;
  }
  const ids = snapshot.commentIds;
  if (cursor.offset < ids.length) {
    const pageKeys = ids.slice(cursor.offset, cursor.offset + limit);
    const quoteIds = pageKeys.filter(isQuoteSnapshotKey).map(quoteIdFromSnapshotKey);
    const [rows, quotes] = await Promise.all([
      commentRankingRepository.rootsByIds(db, commentKeysIn(pageKeys), viewerId).then((found) => keepVisibleAuthors(context, viewerId, found)),
      loadQuoteItemsByIds(context, viewerId, post, quoteIds),
    ]);
    const byId = new Map(rows.map((row) => [row.id, row]));
    const order = pageKeys.flatMap((key): RankedEntry[] => {
      if (isQuoteSnapshotKey(key)) return quotes.has(quoteIdFromSnapshotKey(key)) ? [{ type: "quote", id: quoteIdFromSnapshotKey(key) }] : [];
      return byId.has(key) ? [{ type: "comment", id: key }] : [];
    });
    const nextOffset = cursor.offset + pageKeys.length;
    const more = nextOffset < ids.length || cursor.hasTail;
    return { roots: order.flatMap((entry) => (entry.type === "comment" ? (byId.get(entry.id) ?? []) : [])), quotes, order, nextCursor: more ? encodeRankedCursor({ ...cursor, offset: nextOffset }) : null };
  }
  if (!cursor.hasTail) return { roots: [], quotes: new Map(), order: [], nextCursor: null };
  const tail = await commentRankingRepository.tailRoots(db, post.id, viewerId, commentKeysIn(ids), snapshot.createdAt, cursor.tailAfterId, limit);
  const pageRows = tail.slice(0, limit);
  const last = pageRows.at(-1);
  const roots = await keepVisibleAuthors(context, viewerId, pageRows);
  return {
    roots,
    quotes: new Map(),
    order: roots.map((row) => ({ type: "comment" as const, id: row.id })),
    nextCursor: tail.length > limit && last !== undefined ? encodeRankedCursor({ ...cursor, tailAfterId: last.id }) : null,
  };
}

export async function loadPreviewChains(context: HandlerContext, viewerId: string | undefined, postAuthorId: string, roots: readonly CommentRow[]): Promise<Map<string, CommentRow[]>> {
  const descendants = await keepVisibleAuthors(context, viewerId, await commentRankingRepository.descendantsForRoots(context.database.client, roots.map((root) => root.id), viewerId, maximumPreviewChainLength));
  const byRoot = new Map<string, CommentRow[]>();
  for (const row of descendants) {
    if (row.rootCommentId === null) continue;
    const list = byRoot.get(row.rootCommentId) ?? [];
    list.push(row);
    byRoot.set(row.rootCommentId, list);
  }
  return new Map(roots.map((root) => [root.id, chooseConversationChain(root, byRoot.get(root.id) ?? [], postAuthorId)]));
}
