import type { ID, Post } from "@/types";
import type { QuoteThreadItem } from "@/types/postThread.type";
import { quotedSummaryFromPost } from "@/utils/quotedPostLinks.util";

import { mockQuotesOf } from "./postAudience.mock";

const toQuoteItem = (post: Post, postId: ID, postAuthorId: ID | null | undefined): QuoteThreadItem => ({
  type: "quote",
  id: post.id,
  postId,
  quotePost: quotedSummaryFromPost(post),
  likes: post.likes,
  commentCount: post.comments,
  isPostAuthor: !!postAuthorId && post.author.id === postAuthorId,
  createdAt: post.createdAt,
});

export const mockQuoteItemsFor = (postId: ID, postAuthorId: ID | null | undefined): QuoteThreadItem[] =>
  mockQuotesOf(postId).filter((post) => post.subscriberOnly !== true).map((post) => toQuoteItem(post, postId, postAuthorId));

export const newestQuotesFirst = (items: readonly QuoteThreadItem[]) => [...items].sort((left, right) => right.createdAt.localeCompare(left.createdAt));

const engagement = (likes: number, replies: number, createdAt: string) => (likes + 2 * replies + 1) / Math.pow((Date.now() - Date.parse(createdAt)) / 3_600_000 + 2, 1.2);

export function mergeQuotesIntoRankedComments<T extends { readonly id: ID; readonly isPinned?: boolean; readonly likes: number; readonly replyCount: number; readonly createdAt: string; readonly author: { readonly id: ID } }>(
  rankedComments: readonly T[],
  quotes: readonly QuoteThreadItem[],
  postAuthorId: ID | null | undefined,
): (T | QuoteThreadItem)[] {
  const leadCount = rankedComments.findIndex((comment) => !comment.isPinned && comment.author.id !== postAuthorId);
  const lead = leadCount === -1 ? [...rankedComments] : rankedComments.slice(0, leadCount);
  const rest = leadCount === -1 ? [] : rankedComments.slice(leadCount);
  const scored = [
    ...rest.map((comment, index) => ({ item: comment as T | QuoteThreadItem, score: engagement(comment.likes, comment.replyCount, comment.createdAt), order: index })),
    ...quotes.map((quote, index) => ({ item: quote as T | QuoteThreadItem, score: engagement(quote.likes, quote.commentCount, quote.createdAt), order: rest.length + index })),
  ].sort((left, right) => right.score - left.score || left.order - right.order);
  return [...lead, ...scored.map((entry) => entry.item)];
}
