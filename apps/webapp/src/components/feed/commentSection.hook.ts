"use client";

import { useInfiniteQuery } from "@tanstack/react-query";

import { retryCommentsPageUnlessCursorExpired, useRestartCommentsOnExpiredCursor } from "@/components/feed/restartCommentsOnExpiredCursor.hook";
import { postsService } from "@/services/posts.service";
import type { CommentWithReplies } from "@/types";
import { isQuoteThreadItem, type CommentSectionFilter, type QuoteThreadItem } from "@/types/postThread.type";

export type CommentSectionItem = CommentWithReplies | QuoteThreadItem;

export const commentSectionFilterOptions = (quoteCount: number | undefined) => [
  { value: "all", label: "Replies" },
  { value: "quotes", label: quoteCount && quoteCount > 0 ? `Quotes (${quoteCount})` : "Quotes" },
] as const;

const isPinnedComment = (item: CommentSectionItem) => !isQuoteThreadItem(item) && item.isPinned === true;

export function useCommentSection(postId: string | null, filter: CommentSectionFilter, onRestartedFromTop: () => void) {
  const queryKey = ["comments", postId ?? "none", filter] as const;
  const query = useInfiniteQuery({
    queryKey,
    queryFn: ({ pageParam }) => postsService.fetchCommentsPage(postId as string, pageParam, filter),
    initialPageParam: null as string | null,
    getNextPageParam: (lastPage) => lastPage.nextCursor,
    retry: retryCommentsPageUnlessCursorExpired,
    enabled: postId !== null,
  });
  const { isRestartingFromTop } = useRestartCommentsOnExpiredCursor(queryKey, query.error, onRestartedFromTop);
  const items: CommentSectionItem[] = (query.data?.pages ?? []).flatMap((page) => page.data);
  const orderedItems = [...items].sort((a, b) => Number(isPinnedComment(b)) - Number(isPinnedComment(a)));
  return { query, items: orderedItems, isRestartingFromTop };
}
