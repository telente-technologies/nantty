"use client";

import Link from "next/link";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";

import { ReportDialog } from "@/components/actions/reportDialog";
import { requireAuthThen } from "@/components/auth/authPrompt.store";
import { MentionText } from "@/components/mentions/mentionText";
import { useSession } from "@/components/providers/sessionProvider";
import { AppIcon } from "@/components/ui/appIcon";
import { LikeActionIcon, LikeFilledActionIcon, ReplyActionIcon } from "@/components/ui/icons";
import { Avatar, MediaImage } from "@/components/ui/media";
import { showToast } from "@/components/ui/toast";
import { commentsService } from "@/services/webActions.service";
import type { ThreadReply as ThreadReplyModel } from "@/types/postThread.type";
import { formatCompactCount, formatTimeSincePosted } from "@/utils/formatDate.util";

import { useThreadReplies } from "./postThread.hook";
import styles from "./thread.module.css";

const ACTION_ICON_SIZE = 17;

interface ThreadReplyRowProps {
  readonly reply: ThreadReplyModel;
  readonly postId: string;
  readonly hasParentAbove: boolean;
  readonly hasChildBelow: boolean;
  readonly showReplyingTo: boolean;
  readonly onReply: (reply: ThreadReplyModel) => void;
}

function ThreadReplyRow({ reply, postId, hasParentAbove, hasChildBelow, showReplyingTo, onReply }: ThreadReplyRowProps) {
  const { viewer } = useSession();
  const queryClient = useQueryClient();
  const [isLiked, setIsLiked] = useState(reply.liked);
  const [likeCount, setLikeCount] = useState(reply.likes);
  const [shouldPopLike, setShouldPopLike] = useState(false);
  const [isReportOpen, setIsReportOpen] = useState(false);
  const firstImage = reply.media?.find((item) => item.type === "image" && item.url);
  const likeMutation = useMutation({
    mutationFn: (likeNow: boolean) => (likeNow ? commentsService.likeComment(reply.id) : commentsService.unlikeComment(reply.id)),
    onMutate: (likeNow) => {
      setIsLiked(likeNow);
      setShouldPopLike(likeNow);
      setLikeCount((count) => Math.max(0, count + (likeNow ? 1 : -1)));
    },
    onError: (_error, likeNow) => {
      setIsLiked(!likeNow);
      setLikeCount((count) => Math.max(0, count + (likeNow ? -1 : 1)));
    },
  });
  const deleteMutation = useMutation({
    mutationFn: () => commentsService.deleteComment(reply.id),
    onSuccess: () => {
      showToast({ text: "Reply deleted" });
      void queryClient.invalidateQueries({ queryKey: ["post-thread", postId] });
      void queryClient.invalidateQueries({ queryKey: ["post-thread-replies"] });
    },
    onError: () => showToast({ text: "Couldn't delete the reply. Try again.", tone: "error" }),
  });
  const isOwnReply = viewer?.id === reply.author.id;

  return (
    <article className={styles.row} aria-label={`Reply from ${reply.author.name}`}>
      <div className={styles.rail} aria-hidden="true">
        <span className={[styles.lineAbove, hasParentAbove ? styles.lineVisible : ""].join(" ")} />
        <Link href={`/${reply.author.username}`} tabIndex={-1}>
          <Avatar name={reply.author.name} src={reply.author.avatarUrl} size="md" />
        </Link>
        <span className={[styles.lineBelow, hasChildBelow ? styles.lineVisible : ""].join(" ")} />
      </div>
      <div className={styles.body}>
        <p className={styles.meta}>
          <Link href={`/${reply.author.username}`} className={styles.name}>
            {reply.author.name}
          </Link>
          {reply.author.verified ? (
            <span className={styles.verified} aria-label="Verified account">
              <AppIcon name="check16" size={10} />
            </span>
          ) : null}
          {reply.isPostAuthor ? <span className={styles.authorBadge}>Author</span> : null}
          <span className={styles.handle}>
            @{reply.author.username} · <time dateTime={reply.createdAt}>{formatTimeSincePosted(reply.createdAt)}</time>
          </span>
        </p>
        {showReplyingTo && reply.replyingTo ? (
          <p className={styles.replyingTo}>
            Replying to <Link href={`/${reply.replyingTo.username}`}>@{reply.replyingTo.username}</Link>
          </p>
        ) : null}
        <p className={styles.text}>
          <MentionText text={reply.text} mentions={reply.mentions} />
        </p>
        {firstImage ? (
          <div className={styles.media} style={{ aspectRatio: firstImage.width && firstImage.height ? `${firstImage.width} / ${firstImage.height}` : "4 / 3" }}>
            <MediaImage src={firstImage.url} alt={`Image in ${reply.author.name}'s reply`} sizes="(max-width: 768px) 80vw, 520px" />
          </div>
        ) : null}
        <div className={styles.actions}>
          <button type="button" className={[styles.action, styles.replyTone].join(" ")} aria-label={`Reply, ${reply.replyCount} replies`} onClick={() => requireAuthThen(() => onReply(reply), "Sign in to reply.")}>
            <span className={styles.halo}>
              <ReplyActionIcon size={ACTION_ICON_SIZE} />
            </span>
            {reply.replyCount > 0 ? <span className={styles.count}>{formatCompactCount(reply.replyCount)}</span> : null}
          </button>
          <button
            type="button"
            className={[styles.action, styles.likeTone, isLiked ? styles.active : "", isLiked && shouldPopLike ? styles.pop : ""].join(" ")}
            aria-pressed={isLiked}
            aria-label={`${isLiked ? "Unlike" : "Like"} reply, ${likeCount} likes`}
            onClick={() => requireAuthThen(() => likeMutation.mutate(!isLiked), "Sign in to like replies.")}
          >
            <span className={styles.halo}>{isLiked ? <LikeFilledActionIcon size={ACTION_ICON_SIZE} /> : <LikeActionIcon size={ACTION_ICON_SIZE} />}</span>
            {likeCount > 0 ? <span className={styles.count}>{formatCompactCount(likeCount)}</span> : null}
          </button>
          {isOwnReply ? (
            <button type="button" className={styles.textAction} onClick={() => deleteMutation.mutate()} disabled={deleteMutation.isPending}>
              Delete
            </button>
          ) : (
            <button type="button" className={styles.textAction} onClick={() => requireAuthThen(() => setIsReportOpen(true), "Sign in to report replies.")}>
              Report
            </button>
          )}
        </div>
      </div>
      <ReportDialog isOpen={isReportOpen} onClose={() => setIsReportOpen(false)} targetType="comment" targetId={reply.id} />
    </article>
  );
}

interface ThreadReplyBranchProps {
  readonly reply: ThreadReplyModel;
  readonly postId: string;
  readonly hasParentAbove: boolean;
  readonly showReplyingTo: boolean;
  readonly onReply: (reply: ThreadReplyModel) => void;
  readonly nestingLevel?: number;
  readonly startExpanded?: boolean;
  readonly onOpenThread?: (reply: ThreadReplyModel) => void;
}

export const MAXIMUM_THREAD_INDENT_LEVELS = 3;

export function ThreadReplyBranch({ reply, postId, hasParentAbove, showReplyingTo, onReply, nestingLevel = 0, startExpanded = false, onOpenThread }: ThreadReplyBranchProps) {
  const [isExpanded, setIsExpanded] = useState(startExpanded);
  const childrenAreIndented = nestingLevel + 1 <= MAXIMUM_THREAD_INDENT_LEVELS;
  const { query, replies } = useThreadReplies(reply.id, isExpanded);
  const children = isExpanded && query.data ? replies : reply.inlineReplies;
  const hiddenCount = Math.max(0, reply.replyCount - children.length);
  const opensThreadInstead = onOpenThread !== undefined && nestingLevel >= MAXIMUM_THREAD_INDENT_LEVELS && hiddenCount > 0 && !isExpanded;
  const canShowMore = !opensThreadInstead && ((!isExpanded && hiddenCount > 0) || (isExpanded && (query.hasNextPage || query.isLoading)));
  const label = query.isFetching && isExpanded ? "Loading replies" : isExpanded ? "Show more replies" : hiddenCount === 1 ? "Show 1 reply" : `Show ${hiddenCount} replies`;

  return (
    <>
      <ThreadReplyRow reply={reply} postId={postId} hasParentAbove={hasParentAbove} hasChildBelow={children.length > 0 || canShowMore || opensThreadInstead} showReplyingTo={showReplyingTo} onReply={onReply} />
      {children.length > 0 ? (
        <div className={childrenAreIndented ? styles.nested : undefined}>
          {children.map((child, index) => (
            <ThreadReplyBranch
              key={child.id}
              reply={child}
              postId={postId}
              hasParentAbove={index === 0}
              showReplyingTo={!childrenAreIndented || index > 0}
              onReply={onReply}
              nestingLevel={nestingLevel + 1}
              onOpenThread={onOpenThread}
            />
          ))}
        </div>
      ) : null}
      {opensThreadInstead ? (
        <button type="button" className={styles.showMore} onClick={() => onOpenThread?.(reply)} aria-label={`View thread, ${hiddenCount} more ${hiddenCount === 1 ? "reply" : "replies"} to ${reply.author.name}`}>
          <span className={styles.showMoreRail} aria-hidden="true" />
          View thread
        </button>
      ) : null}
      {canShowMore ? (
        <button
          type="button"
          className={styles.showMore}
          onClick={() => (isExpanded ? void query.fetchNextPage() : setIsExpanded(true))}
          disabled={query.isFetching}
        >
          <span className={[styles.showMoreRail, children.length === 0 ? styles.showMoreRailJoined : ""].join(" ")} aria-hidden="true" />
          {label}
        </button>
      ) : null}
    </>
  );
}
