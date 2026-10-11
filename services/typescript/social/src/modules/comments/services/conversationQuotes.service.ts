import { badRequest } from "../../../errors/social.error.js";
import type { HandlerContext } from "../../../types/handlerContext.type.js";
import type { Page } from "../../../types/pagination.type.js";
import type { PostRow } from "../../posts/repositories/post.repository.js";
import { selectPostsViewerMayEmbed, toQuotedPostSummary } from "../../posts/services/quotedPostEmbed.service.js";
import { resolveCurrentViewerContentPolicy, sensitiveLabelFilterForViewer } from "../../posts/services/sensitiveContent.service.js";
import type { QuoteThreadItem } from "../models/comment.model.js";
import { conversationQuotesRepository } from "../repositories/conversationQuotes.repository.js";
import type { RankableRoot } from "./commentRanking.service.js";

const quoteKeyPrefix = "q:";
const uuidPattern = /^[0-9a-f-]{36}$/i;

export const quoteSnapshotKey = (quotePostId: string) => `${quoteKeyPrefix}${quotePostId}`;
export const isQuoteSnapshotKey = (key: string) => key.startsWith(quoteKeyPrefix);
export const quoteIdFromSnapshotKey = (key: string) => key.slice(quoteKeyPrefix.length);

interface ConversationPost {
  readonly id: string;
  readonly authorId: string;
}

async function keepQuotesViewerMaySee(context: HandlerContext, viewerId: string | undefined, rows: readonly PostRow[]): Promise<PostRow[]> {
  if (rows.length === 0) return [];
  const policy = await resolveCurrentViewerContentPolicy(context, viewerId);
  return (await selectPostsViewerMayEmbed(context, viewerId, rows, policy)).filter((row) => row.visibility !== "subscribers" || row.authorId === viewerId);
}

export async function rankableQuotesForViewer(context: HandlerContext, viewerId: string | undefined, post: ConversationPost): Promise<RankableRoot[]> {
  const rows = await keepQuotesViewerMaySee(context, viewerId, await conversationQuotesRepository.rankingCandidates(context.database.client, post.id));
  return rows.map((row) => ({ id: quoteSnapshotKey(row.id), authorId: row.authorId, isPinned: false, likeCount: row.likeCount, replyCount: row.commentCount, createdAt: row.createdAt }));
}

async function toQuoteItems(context: HandlerContext, post: ConversationPost, rows: readonly PostRow[]): Promise<QuoteThreadItem[]> {
  const authors = await context.directory.findUserSummaries([...new Set(rows.map((row) => row.authorId))]);
  return rows.flatMap((row) => {
    const author = authors.get(row.authorId);
    if (author === undefined) return [];
    return [{
      type: "quote" as const, id: row.id, postId: post.id, quotePost: toQuotedPostSummary(row, author),
      likes: row.likeCount, commentCount: row.commentCount, isPostAuthor: row.authorId === post.authorId, createdAt: row.createdAt.toISOString(),
    }];
  });
}

export async function loadQuoteItemsByIds(context: HandlerContext, viewerId: string | undefined, post: ConversationPost, ids: readonly string[]): Promise<Map<string, QuoteThreadItem>> {
  if (ids.length === 0) return new Map();
  const rows = await keepQuotesViewerMaySee(context, viewerId, await conversationQuotesRepository.quotesByIds(context.database.client, post.id, ids));
  return new Map((await toQuoteItems(context, post, rows)).map((item) => [item.id, item]));
}

export async function pageQuotesOnly(context: HandlerContext, viewerId: string | undefined, post: ConversationPost, cursor: string | undefined, limit: number): Promise<Page<QuoteThreadItem>> {
  if (cursor !== undefined && !uuidPattern.test(cursor)) throw badRequest("CURSOR_EXPIRED", "This list changed. Refresh to see the latest quotes.");
  const policy = await resolveCurrentViewerContentPolicy(context, viewerId);
  const fetched = await conversationQuotesRepository.pageNewest(context.database.client, post.id, cursor, limit, sensitiveLabelFilterForViewer(policy));
  const pageRows = fetched.slice(0, limit);
  const last = pageRows.at(-1);
  const visible = await keepQuotesViewerMaySee(context, viewerId, pageRows);
  return { data: await toQuoteItems(context, post, visible), nextCursor: fetched.length > limit && last !== undefined ? last.id : null };
}
