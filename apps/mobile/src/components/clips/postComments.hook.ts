import { useInfiniteQuery } from "@tanstack/react-query";

import { retryCommentsPageUnlessCursorExpired, useRestartCommentsOnExpiredCursor } from "@/hooks/useRestartCommentsOnExpiredCursor.hook";
import { postCommentsService } from "@/services/content/postComments.service";
import type { Comment, CommentWithReplies } from "@/types";
import { isQuoteThreadItem, type CommentSectionFilter, type QuoteThreadItem } from "@/types/postThread.type";

export type CommentSectionItem = CommentWithReplies | QuoteThreadItem;

export const topLevelCommentsQueryKey = (postId: string | null, filter: CommentSectionFilter = "all") => ["post-comments", postId, filter] as const;
export const commentRepliesQueryKey = (commentId: string) => ["comment-replies", commentId] as const;

export function useTopLevelCommentsForPost(postId: string | null, onRestartedFromTop?: () => void, filter: CommentSectionFilter = "all") {
  const query = useInfiniteQuery({
    queryKey: topLevelCommentsQueryKey(postId, filter),
    queryFn: ({ pageParam }) => postCommentsService.fetchTopLevelCommentsForPost(postId!, pageParam, filter),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined,
    enabled: !!postId,
    retry: retryCommentsPageUnlessCursorExpired,
  });
  const { isRestartingFromTop } = useRestartCommentsOnExpiredCursor(topLevelCommentsQueryKey(postId, filter), query.error, onRestartedFromTop);
  const items: readonly CommentSectionItem[] = query.data?.pages.flatMap((page) => page.data) ?? [];
  const topLevelComments: readonly CommentWithReplies[] = items.filter((item): item is CommentWithReplies => !isQuoteThreadItem(item));
  const loadNextPageOfTopLevelComments = () => {
    if (query.hasNextPage && !query.isFetchingNextPage && !isRestartingFromTop) query.fetchNextPage().catch(() => undefined);
  };
  return { query, items, topLevelComments, loadNextPageOfTopLevelComments, isRestartingFromTop };
}

export function useRepliesForComment(commentId: string, shouldLoadReplies: boolean) {
  const query = useInfiniteQuery({
    queryKey: commentRepliesQueryKey(commentId),
    queryFn: ({ pageParam }) => postCommentsService.fetchRepliesForComment(commentId, pageParam),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined,
    enabled: shouldLoadReplies && !commentId.startsWith("pending_"),
  });
  const loadedReplies: readonly Comment[] = query.data?.pages.flatMap((page) => page.data) ?? [];
  return { query, loadedReplies };
}
