"use client";

import { useInfiniteQuery } from "@tanstack/react-query";

import { RetryButton } from "@/components/ui/controls";
import { EmptyState, ErrorState, Skeleton } from "@/components/ui/feedback";
import { Avatar } from "@/components/ui/media";
import { postsService } from "@/services/posts.service";
import { formatCountWithThousandsSuffix, formatTimeSincePosted } from "@/utils/formatDate.util";
import type { Comment } from "@/types";

import styles from "./commentsPanel.module.css";

function CommentRow({ comment, isReply = false }: { readonly comment: Comment; readonly isReply?: boolean }) {
  return (
    <div className={[styles.comment, isReply ? styles.reply : ""].join(" ")}>
      <Avatar name={comment.author.name} src={comment.author.avatarUrl} size={isReply ? "xs" : "sm"} />
      <div className={styles.commentBody}>
        <p className={styles.commentMeta}>
          <strong>{comment.author.name}</strong>
          <span>{formatTimeSincePosted(comment.createdAt)}</span>
        </p>
        <p className={styles.commentText}>{comment.text}</p>
        {comment.likes > 0 ? <p className={styles.commentLikes}>{formatCountWithThousandsSuffix(comment.likes)} likes</p> : null}
      </div>
    </div>
  );
}

export function CommentsPanel({ postId, totalComments }: { readonly postId: string; readonly totalComments: number }) {
  const commentsQuery = useInfiniteQuery({
    queryKey: ["comments", postId],
    queryFn: ({ pageParam }) => postsService.fetchCommentsPage(postId, pageParam),
    initialPageParam: null as string | null,
    getNextPageParam: (lastPage) => lastPage.nextCursor,
  });
  const comments = (commentsQuery.data?.pages ?? []).flatMap((page) => page.data);

  return (
    <section className={styles.panel} aria-labelledby={`comments-${postId}`}>
      <h2 id={`comments-${postId}`} className={styles.title}>
        Comments <span className={styles.count}>{formatCountWithThousandsSuffix(totalComments)}</span>
      </h2>
      {commentsQuery.isLoading ? (
        <div className={styles.list}>
          {[0, 1, 2].map((index) => (
            <Skeleton key={index} height={48} />
          ))}
        </div>
      ) : commentsQuery.isError ? (
        <ErrorState description="We couldn't load comments." action={<RetryButton onRetry={() => commentsQuery.refetch()} />} />
      ) : comments.length === 0 ? (
        <EmptyState title="No comments yet" description="Comments from the Zudomart app show up here." />
      ) : (
        <div className={styles.list}>
          {comments.map((comment) => (
            <div key={comment.id} className={styles.thread}>
              <CommentRow comment={comment} />
              {comment.previewReplies.map((reply) => (
                <CommentRow key={reply.id} comment={reply} isReply />
              ))}
            </div>
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
