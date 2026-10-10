import { useInfiniteQuery } from "@tanstack/react-query";

import { postCommentsService } from "@/services/content/postComments.service";
import type { Comment, CommentWithReplies } from "@/types";

export const topLevelCommentsQueryKey = (postId: string | null) => ["post-comments", postId] as const;
export const commentRepliesQueryKey = (commentId: string) => ["comment-replies", commentId] as const;

export function useTopLevelCommentsForPost(postId: string | null) {
  const query = useInfiniteQuery({
    queryKey: topLevelCommentsQueryKey(postId),
    queryFn: ({ pageParam }) => postCommentsService.fetchTopLevelCommentsForPost(postId!, pageParam),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined,
    enabled: !!postId,
  });
  const topLevelComments: readonly CommentWithReplies[] = query.data?.pages.flatMap((page) => page.data) ?? [];
  const loadNextPageOfTopLevelComments = () => {
    if (query.hasNextPage && !query.isFetchingNextPage) query.fetchNextPage().catch(() => undefined);
  };
  return { query, topLevelComments, loadNextPageOfTopLevelComments };
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
