"use client";

import { useModalFocusTrap } from "@nantty/web-kit";
import { useRouter } from "next/navigation";
import { useRef, useState } from "react";

import { EmptyState, ErrorState, Skeleton } from "@/components/ui/feedback";
import { CloseIcon } from "@/components/ui/icons";
import { CommentComposer } from "@/components/feed/commentComposer";
import { commentSectionFilterOptions, useCommentSection } from "@/components/feed/commentSection.hook";
import { CommentThread } from "@/components/feed/commentThread";
import { QuoteThreadItemRow } from "@/components/feed/thread/quoteThreadItem";
import { useSession } from "@/components/providers/sessionProvider";
import { UnderlineTabs } from "@/components/ui/underlineTabs";
import { isQuoteThreadItem, type CommentSectionFilter } from "@/types/postThread.type";
import { formatCountWithThousandsSuffix } from "@/utils/formatDate.util";
import { buildClipVideoReplyTarget, clipVideoReplyHref } from "@/utils/clipVideoReply.util";

import styles from "./page.module.css";

interface ClipCommentsSheetProps {
  readonly postId: string | null;
  readonly postAuthorId?: string;
  readonly totalComments: number;
  readonly quoteCount?: number;
  readonly onClose: () => void;
}

export function ClipCommentsSheet({ postId, postAuthorId, totalComments, quoteCount, onClose }: ClipCommentsSheetProps) {
  const listRef = useRef<HTMLDivElement | null>(null);
  const router = useRouter();
  const { viewer } = useSession();
  const [chosenFilter, setFilter] = useState<CommentSectionFilter>("all");
  const hasQuotes = (quoteCount ?? 0) > 0;
  const canStartVideoReply = !!postId && !!postAuthorId && viewer?.id === postAuthorId;
  const filter: CommentSectionFilter = hasQuotes ? chosenFilter : "all";
  const { query: commentsQuery, items: orderedComments, isRestartingFromTop } = useCommentSection(postId, filter, () => listRef.current?.scrollTo({ top: 0 }));

  const sheetRef = useRef<HTMLElement | null>(null);
  useModalFocusTrap(sheetRef, postId !== null, onClose);

  if (!postId) return null;

  return (
    <div className={styles.sheetScrim} onClick={onClose}>
      <section
        ref={sheetRef}
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
        {hasQuotes ? <UnderlineTabs options={commentSectionFilterOptions(quoteCount)} value={filter} onChange={setFilter} label="Show replies or quotes" panelId={`clip-comments-${postId}`} /> : null}
        <div ref={listRef} className={styles.sheetList} id={`clip-comments-${postId}`} role="tabpanel">
          {commentsQuery.isLoading ? (
            [0, 1, 2].map((index) => <Skeleton key={index} height={48} />)
          ) : commentsQuery.isError && !isRestartingFromTop ? (
            <ErrorState description="We couldn't load comments." error={commentsQuery.error} onRetry={() => void commentsQuery.refetch()} />
          ) : orderedComments.length === 0 ? (
            filter === "quotes" ? <EmptyState title="No quotes yet" description="When someone quotes this clip, it shows up here." /> : <EmptyState title="No comments yet" description="Start the conversation." />
          ) : (
            <>
              {orderedComments.map((item) =>
                isQuoteThreadItem(item) ? <QuoteThreadItemRow key={`quote-${item.id}`} item={item} /> : <CommentThread key={item.id} comment={item} postId={postId} postAuthorId={postAuthorId} onReplyWithVideo={canStartVideoReply ? (comment) => {
                  const target = buildClipVideoReplyTarget(comment, postId);
                  if (target) router.push(clipVideoReplyHref(target));
                } : undefined} />,
              )}
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
