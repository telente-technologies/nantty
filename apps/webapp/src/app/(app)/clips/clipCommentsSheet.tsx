"use client";

import { useInfiniteQuery } from "@tanstack/react-query";
import { useEffect } from "react";

import { RetryButton } from "@/components/ui/controls";
import { EmptyState, ErrorState, Skeleton } from "@/components/ui/feedback";
import { CloseIcon } from "@/components/ui/icons";
import { CommentComposer } from "@/components/feed/commentComposer";
import { CommentThread } from "@/components/feed/commentThread";
import { postsService } from "@/services/posts.service";
import { formatCountWithThousandsSuffix } from "@/utils/formatDate.util";

import styles from "./page.module.css";

interface ClipCommentsSheetProps {
  readonly postId: string | null;
  readonly postAuthorId?: string;
  readonly totalComments: number;
  readonly onClose: () => void;
}

export function ClipCommentsSheet({ postId, postAuthorId, totalComments, onClose }: ClipCommentsSheetProps) {
  const commentsQuery = useInfiniteQuery({
    queryKey: ["comments", postId ?? "none"],
    queryFn: ({ pageParam }) => postsService.fetchCommentsPage(postId as string, pageParam),
    initialPageParam: null as string | null,
    getNextPageParam: (lastPage) => lastPage.nextCursor,
    enabled: postId !== null,
  });
  const comments = (commentsQuery.data?.pages ?? []).flatMap((page) => page.data);
  const orderedComments = [...comments].sort((a, b) => Number(b.isPinned === true) - Number(a.isPinned === true));

  useEffect(() => {
    if (!postId) return;
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [postId, onClose]);

  if (!postId) return null;

  return (
    <div className={styles.sheetScrim} onClick={onClose}>
      <section
        className={styles.sheet}
        role="dialog"
        aria-modal="true"
        aria-label="Clip comments"
        onClick={(event) => event.stopPropagation()}
      >
        <div className={styles.sheetHandle} aria-hidden="true" />
        <div className={styles.sheetTitleRow}>
          <h2 className={styles.sheetTitle}>
            Comments <span className={styles.sheetCount}>{formatCountWithThousandsSuffix(totalComments)}</span>
          </h2>
          <button type="button" className={styles.sheetClose} aria-label="Close comments" onClick={onClose}>
            <CloseIcon size={18} />
          </button>
        </div>
        <div className={styles.sheetList}>
          {commentsQuery.isLoading ? (
            [0, 1, 2].map((index) => <Skeleton key={index} height={48} />)
          ) : commentsQuery.isError ? (
            <ErrorState description="We couldn't load comments." action={<RetryButton onRetry={() => commentsQuery.refetch()} />} />
          ) : comments.length === 0 ? (
            <EmptyState title="No comments yet" description="Start the conversation." />
          ) : (
            <>
              {orderedComments.map((comment) => (
                <CommentThread key={comment.id} comment={comment} postId={postId} postAuthorId={postAuthorId} />
              ))}
              {commentsQuery.hasNextPage ? (
                <button
                  type="button"
                  className={styles.sheetMore}
                  onClick={() => commentsQuery.fetchNextPage()}
                  disabled={commentsQuery.isFetchingNextPage}
                >
                  {commentsQuery.isFetchingNextPage ? "Loading…" : "Show more comments"}
                </button>
              ) : null}
            </>
          )}
        </div>
        <div className={styles.sheetComposer}>
          <CommentComposer postId={postId} />
        </div>
      </section>
    </div>
  );
}
