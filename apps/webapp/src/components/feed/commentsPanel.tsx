"use client";

import { useInfiniteQuery } from "@tanstack/react-query";
import { useRef } from "react";

import { EmptyState, ErrorState, Skeleton } from "@/components/ui/feedback";
import { retryCommentsPageUnlessCursorExpired, useRestartCommentsOnExpiredCursor } from "@/components/feed/restartCommentsOnExpiredCursor.hook";
import { postsService } from "@/services/posts.service";
import { formatCountWithThousandsSuffix } from "@/utils/formatDate.util";

import { CommentComposer } from "./commentComposer";
import { CommentThread } from "./commentThread";
import styles from "./commentsPanel.module.css";

export function CommentsPanel({ postId, postAuthorId, totalComments }: { readonly postId: string; readonly postAuthorId?: string; readonly totalComments: number }) {
  const commentsQuery = useInfiniteQuery({
    queryKey: ["comments", postId],
    queryFn: ({ pageParam }) => postsService.fetchCommentsPage(postId, pageParam),
    initialPageParam: null as string | null,
    getNextPageParam: (lastPage) => lastPage.nextCursor,
    retry: retryCommentsPageUnlessCursorExpired,
  });
  const panelRef = useRef<HTMLElement | null>(null);
  const { isRestartingFromTop } = useRestartCommentsOnExpiredCursor(["comments", postId], commentsQuery.error, () => panelRef.current?.scrollIntoView({ block: "start" }));
  const comments = (commentsQuery.data?.pages ?? []).flatMap((page) => page.data);
  const orderedComments = [...comments].sort((a, b) => Number(b.isPinned === true) - Number(a.isPinned === true));

  return (
    <section ref={panelRef} className={styles.panel} id="comments" aria-labelledby={`comments-${postId}`}>
      <h2 id={`comments-${postId}`} className={styles.title}>
        Comments <span className={styles.count}>{formatCountWithThousandsSuffix(totalComments)}</span>
      </h2>
      <CommentComposer postId={postId} />
      {commentsQuery.isLoading ? (
        <div className={styles.list}>
          {[0, 1, 2].map((index) => (
            <Skeleton key={index} height={48} />
          ))}
        </div>
      ) : commentsQuery.isError && !isRestartingFromTop ? (
        <ErrorState description="We couldn't load comments." error={commentsQuery.error} onRetry={() => void commentsQuery.refetch()} />
      ) : comments.length === 0 ? (
        <EmptyState title="No comments yet" description="Start the conversation." />
      ) : (
        <div className={styles.list}>
          {orderedComments.map((comment) => (
            <CommentThread key={comment.id} comment={comment} postId={postId} postAuthorId={postAuthorId} />
          ))}
          {commentsQuery.hasNextPage ? (
            <button type="button" className={styles.more} onClick={() => commentsQuery.fetchNextPage()} disabled={commentsQuery.isFetchingNextPage}>
              {commentsQuery.isFetchingNextPage ? "Loading…" : "Show more comments"}
            </button>
          ) : null}
        </div>
      )}
    </section>
  );
}
