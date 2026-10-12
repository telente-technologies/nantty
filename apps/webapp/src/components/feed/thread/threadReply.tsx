"use client";

import Link from "next/link";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";

import { ReportDialog } from "@/components/actions/reportDialog";
import { requireAuthThen } from "@/components/auth/authPrompt.store";
import { MentionText } from "@/components/mentions/mentionText";
import { useSession } from "@/components/providers/sessionProvider";
import { useSaveToggle } from "@/components/saves/useSaveToggle.hook";
import { AppIcon } from "@/components/ui/appIcon";
import { BookmarkActionIcon, BookmarkFilledActionIcon, LikeActionIcon, LikeFilledActionIcon, ReplyActionIcon, RepostActionIcon, ShareActionIcon } from "@/components/ui/icons";
import { Avatar, MediaImage } from "@/components/ui/media";
import { showToast } from "@/components/ui/toast";
import { commentsService } from "@/services/webActions.service";
import { postsService } from "@/services/posts.service";
import { buildAbsoluteSiteUrl } from "@/utils/seoPaths.util";
import type { ThreadReply as ThreadReplyModel } from "@/types/postThread.type";
import { formatCompactCount, formatTimeSincePosted } from "@/utils/formatDate.util";

import { useThreadReplies } from "./postThread.hook";
import { QuotedPostCard } from "../quotedPostCard";
import styles from "./thread.module.css";
import { describeCount } from "@/utils/countLabel.util";

const ACTION_ICON_SIZE = 17;

interface ThreadReplyRowProps {
  readonly reply: ThreadReplyModel;
  readonly postId: string;
  readonly postAuthorId?: string;
  readonly hasParentAbove: boolean;
  readonly hasChildBelow: boolean;
  readonly showReplyingTo: boolean;
  readonly onReply: (reply: ThreadReplyModel) => void;
  readonly onRepostReply?: (reply: ThreadReplyModel) => void;
}

function ThreadReplyRow({ reply, postId, postAuthorId, hasParentAbove, hasChildBelow, showReplyingTo, onReply, onRepostReply }: ThreadReplyRowProps) {
  const { viewer } = useSession();
  const queryClient = useQueryClient();
  const [isLiked, setIsLiked] = useState(reply.liked);
  const [likeCount, setLikeCount] = useState(reply.likes);
  const [shouldPopLike, setShouldPopLike] = useState(false);
  const [isReportOpen, setIsReportOpen] = useState(false);
  const [pinOverride, setPinOverride] = useState<boolean | null>(null);
  const optimisticPinned = pinOverride ?? reply.isPinned === true;
  const { isSaved, toggleSaved } = useSaveToggle("comment", reply.id, reply.bookmarked ?? false);
  const canPin = postAuthorId !== undefined && viewer?.id === postAuthorId && reply.parentCommentId === null;
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
  const pinMutation = useMutation({
    mutationFn: async () => {
      if (optimisticPinned) await commentsService.unpinComment(postId, reply.id);
      else await commentsService.pinComment(postId, reply.id);
    },
    onMutate: () => setPinOverride(!optimisticPinned),
    onSuccess: async () => {
      void queryClient.invalidateQueries({ queryKey: ["comments", postId] });
      await queryClient.invalidateQueries({ queryKey: ["post-thread", postId] });
      setPinOverride(null);
    },
    onError: () => {
      setPinOverride(null);
      showToast({ text: "Couldn't update the pin. Try again.", tone: "error" });
    },
  });
  const hideMutation = useMutation({
    mutationFn: () => commentsService.hideComment(postId, reply.id),
    onSuccess: () => {
      showToast({ text: "Reply hidden. Find it in Settings, Hidden comments." });
      void queryClient.invalidateQueries({ queryKey: ["post-thread", postId] });
      void queryClient.invalidateQueries({ queryKey: ["post-thread-replies"] });
      void queryClient.invalidateQueries({ queryKey: ["comments", postId] });
      void queryClient.invalidateQueries({ queryKey: ["hidden-comments"] });
    },
    onError: () => showToast({ text: "Couldn't hide the reply. Try again.", tone: "error" }),
  });
  const isOwnReply = viewer?.id === reply.author.id;
  const canHide = postAuthorId !== undefined && viewer?.id === postAuthorId && !isOwnReply;

  async function copyReplyLinkToClipboard() {
    try {
      await navigator.clipboard.writeText(buildAbsoluteSiteUrl(`/post/${postId}#${reply.id}`));
      showToast({ text: "Link copied" });
      postsService.recordPostShare(postId).catch(() => undefined);
    } catch {
      showToast({ text: "Couldn't copy the link", tone: "error" });
    }
  }

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
          {optimisticPinned ? (
            <span className={styles.pinnedBadge} aria-label="Pinned by author">
              <AppIcon name="pushPin24" size={12} /> Pinned by author
            </span>
          ) : null}
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
        {reply.quotedPost || reply.quotedPostUnavailable ? <QuotedPostCard quoted={reply.quotedPost ?? null} unavailable={!reply.quotedPost} /> : null}
        {firstImage ? (
          <div className={styles.media} style={{ aspectRatio: firstImage.width && firstImage.height ? `${firstImage.width} / ${firstImage.height}` : "4 / 3" }}>
            <MediaImage src={firstImage.url} alt={`Image in ${reply.author.name}'s reply`} sizes="(max-width: 768px) 80vw, 520px" />
          </div>
        ) : null}
        <div className={styles.actions}>
          <div className={styles.primaryActions}>
            <button type="button" className={[styles.action, styles.replyTone].join(" ")} aria-label={`Reply, ${describeCount(reply.replyCount, "reply", "replies")}`} onClick={() => requireAuthThen(() => onReply(reply), "Sign in to reply.")}>
              <span className={styles.halo}>
                <ReplyActionIcon size={ACTION_ICON_SIZE} />
              </span>
              {reply.replyCount > 0 ? <span className={styles.count}>{formatCompactCount(reply.replyCount)}</span> : null}
            </button>
            {onRepostReply ? (
              <button type="button" className={[styles.action, styles.replyTone].join(" ")} aria-label="Repost" onClick={() => requireAuthThen(() => onRepostReply(reply), "Sign in to repost.")}>
                <span className={styles.halo}>
                  <RepostActionIcon size={ACTION_ICON_SIZE} />
                </span>
              </button>
            ) : null}
            <button
              type="button"
              className={[styles.action, styles.likeTone, isLiked ? styles.active : "", isLiked && shouldPopLike ? styles.pop : ""].join(" ")}
              aria-pressed={isLiked}
              aria-label={`${isLiked ? "Unlike" : "Like"} reply, ${describeCount(likeCount, "like", "likes")}`}
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
            {canPin ? (
              <button type="button" className={styles.textAction} onClick={() => pinMutation.mutate()} disabled={pinMutation.isPending}>
                {optimisticPinned ? "Unpin" : "Pin"}
              </button>
            ) : null}
            {canHide ? (
              <button type="button" className={styles.textAction} onClick={() => hideMutation.mutate()} disabled={hideMutation.isPending}>
                Hide
              </button>
            ) : null}
          </div>
          <div className={styles.secondaryActions}>
            <button
              type="button"
              className={[styles.action, isSaved ? styles.active : ""].join(" ")}
              aria-pressed={isSaved}
              aria-label={isSaved ? "Remove reply from saved" : "Save reply"}
              onClick={() => toggleSaved()}
            >
              <span className={styles.halo}>{isSaved ? <BookmarkFilledActionIcon size={ACTION_ICON_SIZE} /> : <BookmarkActionIcon size={ACTION_ICON_SIZE} />}</span>
            </button>
            <button type="button" className={[styles.action, styles.replyTone].join(" ")} aria-label="Share reply" onClick={() => requireAuthThen(() => void copyReplyLinkToClipboard(), "Sign in to share replies.")}>
              <span className={styles.halo}>
                <ShareActionIcon size={ACTION_ICON_SIZE} />
              </span>
            </button>
          </div>
        </div>
      </div>
      <ReportDialog isOpen={isReportOpen} onClose={() => setIsReportOpen(false)} targetType="comment" targetId={reply.id} />
    </article>
  );
}

interface ThreadReplyBranchProps {
  readonly reply: ThreadReplyModel;
  readonly postId: string;
  readonly postAuthorId?: string;
  readonly hasParentAbove: boolean;
  readonly showReplyingTo: boolean;
  readonly onReply: (reply: ThreadReplyModel) => void;
  readonly onRepostReply?: (reply: ThreadReplyModel) => void;
  readonly nestingLevel?: number;
  readonly startExpanded?: boolean;
  readonly onOpenThread?: (reply: ThreadReplyModel) => void;
  readonly localRepliesFor?: (parentId: string) => readonly ThreadReplyModel[];
}

export const MAXIMUM_THREAD_INDENT_LEVELS = 3;

export function ThreadReplyBranch({ reply, postId, postAuthorId, hasParentAbove, showReplyingTo, onReply, onRepostReply, nestingLevel = 0, startExpanded = false, onOpenThread, localRepliesFor }: ThreadReplyBranchProps) {
  const [isExpanded, setIsExpanded] = useState(startExpanded);
  const { query, replies } = useThreadReplies(reply.id, isExpanded);
  const serverChildren = isExpanded && query.data ? replies : reply.inlineReplies;
  const children = [...serverChildren, ...(localRepliesFor?.(reply.id) ?? []).filter((local) => !serverChildren.some((child) => child.id === local.id))];
  const continuesAsChain = children.length === 1 && !isExpanded;
  const childrenAreIndented = nestingLevel + 1 <= MAXIMUM_THREAD_INDENT_LEVELS && !continuesAsChain;
  const hiddenCount = Math.max(0, reply.replyCount - serverChildren.length);
  const opensThreadInstead = onOpenThread !== undefined && hiddenCount > 0 && !isExpanded && (nestingLevel >= MAXIMUM_THREAD_INDENT_LEVELS || reply.continuesInThread === true);
  const canShowMore = !opensThreadInstead && ((!isExpanded && hiddenCount > 0) || (isExpanded && (query.hasNextPage || query.isLoading)));
  const label = query.isFetching && isExpanded ? "Loading replies" : isExpanded ? "Show more replies" : `Show ${hiddenCount}${children.length > 0 ? " more" : ""} ${hiddenCount === 1 ? "reply" : "replies"}`;

  return (
    <>
      <ThreadReplyRow reply={reply} postId={postId} postAuthorId={postAuthorId} hasParentAbove={hasParentAbove} hasChildBelow={children.length > 0 || canShowMore || opensThreadInstead} showReplyingTo={showReplyingTo} onReply={onReply} onRepostReply={onRepostReply} />
      {children.length > 0 ? (
        <div className={childrenAreIndented ? styles.nested : undefined}>
          {children.map((child, index) => (
            <ThreadReplyBranch
              key={child.id}
              reply={child}
              postId={postId}
              postAuthorId={postAuthorId}
              hasParentAbove={index === 0}
              showReplyingTo={!continuesAsChain && (!childrenAreIndented || index > 0)}
              onReply={onReply}
              onRepostReply={onRepostReply}
              nestingLevel={continuesAsChain ? nestingLevel : nestingLevel + 1}
              onOpenThread={onOpenThread}
              localRepliesFor={localRepliesFor}
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
          onClick={() => {
            if (query.isFetching) return;
            if (isExpanded) void query.fetchNextPage();
            else setIsExpanded(true);
          }}
          disabled={query.isFetching}
        >
          <span className={[styles.showMoreRail, children.length === 0 ? styles.showMoreRailJoined : ""].join(" ")} aria-hidden="true" />
          {label}
        </button>
      ) : null}
    </>
  );
}
