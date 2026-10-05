import { useInfiniteQuery, useQueries } from "@tanstack/react-query";
import { useMemo } from "react";

import { postThreadService } from "@/services/postThread.service";
import { useAuthStore } from "@/store/auth.store";
import type { Comment } from "@/types";
import type { ThreadReply, ThreadRow, ThreadSort } from "@/types/postThread.type";

export const FIRST_AD_SLOT_AFTER_REPLIES = 3;
export const REPLIES_BETWEEN_ADS = 8;

export const postThreadQueryKey = (postId: string, sort: ThreadSort) => ["post-thread", postId, sort] as const;
export const threadRepliesQueryKey = (commentId: string) => ["post-thread-replies", commentId] as const;

export const adSlotPositionsFor = (replyCount: number): number[] => {
  const positions: number[] = [];
  for (let position = FIRST_AD_SLOT_AFTER_REPLIES; position < replyCount; position += REPLIES_BETWEEN_ADS) positions.push(position);
  return positions;
};

export const toLocalThreadReply = (comment: Comment, postAuthorId: string | undefined, hasParentAbove: boolean): ThreadReply => ({
  ...comment,
  isPostAuthor: comment.author.id === postAuthorId,
  connector: { depth: hasParentAbove ? 1 : 0, hasParentAbove, hasChildBelow: false, isLastInChain: true },
  inlineReplies: [],
});

export function usePostConversation(postId: string, sort: ThreadSort) {
  const isSignedIn = useAuthStore((state) => state.status === "signedIn");
  const query = useInfiniteQuery({
    queryKey: postThreadQueryKey(postId, sort),
    queryFn: ({ pageParam }) => postThreadService.fetchConversation(postId, sort, pageParam),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined,
  });
  const conversations = useMemo(() => {
    const seen = new Set<string>();
    return (query.data?.pages ?? []).flatMap((page) => page.data).filter((reply) => (seen.has(reply.id) ? false : (seen.add(reply.id), true)));
  }, [query.data]);
  const slotPositions = adSlotPositionsFor(conversations.length);

  const adDecisions = useQueries({
    queries: slotPositions.map((position, slotIndex) => ({
      queryKey: ["post-thread-ad", postId, slotIndex] as const,
      queryFn: () =>
        postThreadService.decideThreadAd(
          postId,
          slotIndex === 0 ? position : REPLIES_BETWEEN_ADS,
          conversations.slice(Math.max(0, position - 2), position + 2).map((reply) => reply.id),
        ),
      enabled: isSignedIn,
      staleTime: Infinity,
      retry: false,
    })),
  });

  const rows: ThreadRow[] = conversations.flatMap((reply, index): ThreadRow[] => {
    const slotIndex = slotPositions.indexOf(index);
    const ad = slotIndex >= 0 ? adDecisions[slotIndex]?.data?.ad : null;
    const replyRow: ThreadRow = { kind: "reply", key: reply.id, reply };
    return ad ? [{ kind: "sponsored", key: `ad-${ad.adId}`, ad }, replyRow] : [replyRow];
  });

  const loadNextPage = () => {
    if (query.hasNextPage && !query.isFetchingNextPage) query.fetchNextPage().catch(() => undefined);
  };
  return { query, rows, loadNextPage };
}

export function useThreadReplies(commentId: string, isExpanded: boolean) {
  const query = useInfiniteQuery({
    queryKey: threadRepliesQueryKey(commentId),
    queryFn: ({ pageParam }) => postThreadService.fetchThreadReplies(commentId, pageParam),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined,
    enabled: isExpanded && !commentId.startsWith("pending_"),
  });
  const replies: readonly ThreadReply[] = query.data?.pages.flatMap((page) => page.data) ?? [];
  return { query, replies };
}
