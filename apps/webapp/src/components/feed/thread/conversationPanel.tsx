"use client";

import { useState } from "react";

import { EmptyState, ErrorState, Skeleton } from "@/components/ui/feedback";
import { UnderlineTabs } from "@/components/ui/underlineTabs";
import { useInfiniteScrollSentinel } from "@/components/ui/useInfiniteScrollSentinel.hook";
import type { Comment, Post } from "@/types";
import type { CommentSectionFilter, ThreadReply, ThreadSort } from "@/types/postThread.type";
import { formatCompactCount } from "@/utils/formatDate.util";

import { usePostConversation } from "./postThread.hook";
import { ReplySettingsControl } from "./replySettingsControl";
import { useSession } from "@/components/providers/sessionProvider";
import { QuoteThreadItemRow } from "./quoteThreadItem";
import { SponsoredThreadItem } from "./sponsoredThreadItem";
import { ThreadComposer } from "./threadComposer";
import { ThreadReplyBranch } from "./threadReply";
import styles from "./thread.module.css";
import panelStyles from "./conversationPanel.module.css";

const SORT_OPTIONS = [
  { value: "relevant", label: "Top" },
  { value: "latest", label: "Latest" },
] as const;

function ThreadSkeleton({ rows }: { readonly rows: number }) {
  return (
    <div aria-busy="true" aria-label="Loading replies">
      {Array.from({ length: rows }, (_, index) => (
        <div key={index} className={panelStyles.skeletonRow}>
          <Skeleton width={44} height={44} circle />
          <div className={panelStyles.skeletonBody}>
            <Skeleton width="50%" height={14} />
            <Skeleton width="92%" height={13} />
            <Skeleton width={index % 2 === 0 ? "70%" : "40%"} height={13} />
          </div>
        </div>
      ))}
    </div>
  );
}

const formatFullTimestamp = (iso: string) => {
  const date = new Date(iso);
  return `${date.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" })} · ${date.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })}`;
};

const filterOptions = (quoteCount: number) => [
  { value: "all", label: "Replies" },
  { value: "quotes", label: quoteCount > 0 ? `Quotes (${formatCompactCount(quoteCount)})` : "Quotes" },
] as const;

export function ConversationPanel({ post }: { readonly post: Post }) {
  const [sort, setSort] = useState<ThreadSort>("relevant");
  const [chosenFilter, setFilter] = useState<CommentSectionFilter>("all");
  const hasQuotes = (post.quotes ?? 0) > 0;
  const filter: CommentSectionFilter = hasQuotes ? chosenFilter : "all";
  const [replyTarget, setReplyTarget] = useState<ThreadReply | null>(null);
  const [focusedReply, setFocusedReply] = useState<ThreadReply | null>(null);
  const [localReplies, setLocalReplies] = useState<Readonly<Record<string, readonly ThreadReply[]>>>({});
  const rememberPostedReply = (created: Comment) => {
    const parentKey = created.parentCommentId ?? "root";
    const asThreadReply: ThreadReply = { ...created, isPostAuthor: created.author.id === post.author.id, connector: { depth: 0, hasParentAbove: false, hasChildBelow: false, isLastInChain: true }, inlineReplies: [] };
    setLocalReplies((current) => ({ ...current, [parentKey]: [...(current[parentKey] ?? []), asThreadReply] }));
  };
  const localRepliesFor = (parentId: string) => localReplies[parentId] ?? [];
  const { viewer } = useSession();
  const isOwnPost = viewer?.id === post.author.id;
  const panelId = `conversation-${post.id}`;
  const { query, rows, isRestartingFromTop } = usePostConversation(post.id, sort, () =>
    document.getElementById(`${panelId}-title`)?.parentElement?.scrollIntoView({ block: "start" }),
  filter);
  const localTopLevel = filter === "quotes" ? [] : (localReplies["root"] ?? []).filter((local) => !rows.some((row) => row.kind === "reply" && row.reply.id === local.id));
  const sentinelRef = useInfiniteScrollSentinel({
    hasNextPage: query.hasNextPage && !query.isError && !isRestartingFromTop,
    isFetchingNextPage: query.isFetchingNextPage,
    fetchNextPage: query.fetchNextPage,
  });

  return (
    <section className={panelStyles.panel} id="comments" aria-labelledby={`${panelId}-title`}>
      <p className={panelStyles.timestamp}>
        <time dateTime={post.createdAt}>{formatFullTimestamp(post.createdAt)}</time>
        {post.views > 0 ? (
          <>
            {" · "}
            <strong>{formatCompactCount(post.views)}</strong> Views
          </>
        ) : null}
      </p>
      <h2 id={`${panelId}-title`} className="visuallyHidden">
        Replies
      </h2>
      {isOwnPost ? <ReplySettingsControl post={post} /> : null}
      {hasQuotes ? <UnderlineTabs options={filterOptions(post.quotes ?? 0)} value={filter} onChange={setFilter} label="Show replies or quotes" panelId={panelId} /> : null}
      {filter === "all" ? <UnderlineTabs options={SORT_OPTIONS} value={sort} onChange={setSort} label="Sort replies" panelId={panelId} /> : null}
      {focusedReply ? (
        <div className={panelStyles.focusBar}>
          <strong>Thread</strong>
          <button type="button" className={styles.textAction} onClick={() => setFocusedReply(null)}>
            Back to all replies
          </button>
        </div>
      ) : null}
      <div id={panelId} role="tabpanel" className={panelStyles.list}>
        {focusedReply ? (
          <div className={panelStyles.conversation}>
            <ThreadReplyBranch key={focusedReply.id} reply={{ ...focusedReply, inlineReplies: [] }} postId={post.id} postAuthorId={post.author.id} hasParentAbove={false} showReplyingTo onReply={setReplyTarget} startExpanded onOpenThread={setFocusedReply} localRepliesFor={localRepliesFor} />
          </div>
        ) : query.isLoading ? (
          <ThreadSkeleton rows={4} />
        ) : query.isError && !isRestartingFromTop ? (
          <ErrorState title="Replies didn't load" description="Check your connection, then try again." error={query.error} onRetry={() => void query.refetch()} />
        ) : rows.length === 0 && localTopLevel.length === 0 ? (
          filter === "quotes" ? <EmptyState title="No quotes yet" description="When someone quotes this post, it shows up here." /> : <EmptyState title="No replies yet" description="Be the first to reply to this post." />
        ) : (
          [...localTopLevel.map((reply) => ({ kind: "reply" as const, key: reply.id, reply })), ...rows].map((row) =>
            row.kind === "sponsored" ? (
              <SponsoredThreadItem key={row.key} ad={row.ad} postId={post.id} />
            ) : row.kind === "quote" ? (
              <div key={row.key} className={panelStyles.conversation}>
                <QuoteThreadItemRow item={row.quote} />
              </div>
            ) : (
              <div key={row.key} className={panelStyles.conversation}>
                <ThreadReplyBranch reply={row.reply} postId={post.id} postAuthorId={post.author.id} hasParentAbove={false} showReplyingTo={false} onReply={setReplyTarget} onOpenThread={setFocusedReply} localRepliesFor={localRepliesFor} />
              </div>
            ),
          )
        )}
        <div ref={sentinelRef} />
        {query.isFetchingNextPage ? <ThreadSkeleton rows={1} /> : null}
      </div>
      <ThreadComposer
        postId={post.id}
        postAuthorUsername={post.author.username}
        replyTarget={replyTarget}
        onCancelReply={() => setReplyTarget(null)}
        replyRestriction={post.viewerCanReply === false ? (post.replyRestriction ?? null) : null}
        onPosted={rememberPostedReply}
      />
    </section>
  );
}
