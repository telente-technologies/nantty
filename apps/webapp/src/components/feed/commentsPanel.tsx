"use client";

import { useRef, useState } from "react";

import { EmptyState, ErrorState, Skeleton } from "@/components/ui/feedback";
import { UnderlineTabs } from "@/components/ui/underlineTabs";
import { isQuoteThreadItem, type CommentSectionFilter } from "@/types/postThread.type";
import { formatCountWithThousandsSuffix } from "@/utils/formatDate.util";

import { CommentComposer } from "./commentComposer";
import { commentSectionFilterOptions, useCommentSection } from "./commentSection.hook";
import { CommentThread } from "./commentThread";
import { QuoteThreadItemRow } from "./thread/quoteThreadItem";
import styles from "./commentsPanel.module.css";

export function CommentsPanel({ postId, postAuthorId, totalComments, quoteCount }: { readonly postId: string; readonly postAuthorId?: string; readonly totalComments: number; readonly quoteCount?: number }) {
  const panelRef = useRef<HTMLElement | null>(null);
  const [chosenFilter, setFilter] = useState<CommentSectionFilter>("all");
  const hasQuotes = (quoteCount ?? 0) > 0;
  const filter: CommentSectionFilter = hasQuotes ? chosenFilter : "all";
  const { query: commentsQuery, items: orderedComments, isRestartingFromTop } = useCommentSection(postId, filter, () => panelRef.current?.scrollIntoView({ block: "start" }));
  const listId = `comments-list-${postId}`;

  return (
    <section ref={panelRef} className={styles.panel} id="comments" aria-labelledby={`comments-${postId}`}>
      <h2 id={`comments-${postId}`} className={styles.title}>
        Comments <span className={styles.count}>{formatCountWithThousandsSuffix(totalComments)}</span>
      </h2>
      <CommentComposer postId={postId} />
      {hasQuotes ? <UnderlineTabs options={commentSectionFilterOptions(quoteCount)} value={filter} onChange={setFilter} label="Show replies or quotes" panelId={listId} /> : null}
      {commentsQuery.isLoading ? (
        <div className={styles.list}>
          {[0, 1, 2].map((index) => (
            <Skeleton key={index} height={48} />
          ))}
        </div>
      ) : commentsQuery.isError && !isRestartingFromTop ? (
        <ErrorState description="We couldn't load comments." error={commentsQuery.error} onRetry={() => void commentsQuery.refetch()} />
      ) : orderedComments.length === 0 ? (
        filter === "quotes" ? <EmptyState title="No quotes yet" description="When someone quotes this, it shows up here." /> : <EmptyState title="No comments yet" description="Start the conversation." />
      ) : (
        <div className={styles.list} id={listId} role="tabpanel">
          {orderedComments.map((item) =>
            isQuoteThreadItem(item) ? <QuoteThreadItemRow key={`quote-${item.id}`} item={item} /> : <CommentThread key={item.id} comment={item} postId={postId} postAuthorId={postAuthorId} />,
          )}
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
