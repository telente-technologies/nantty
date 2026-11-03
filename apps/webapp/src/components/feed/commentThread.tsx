"use client";

import { useInfiniteQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { useState } from "react";

import { ReportDialog } from "@/components/actions/reportDialog";
import { requireAuthThen } from "@/components/auth/authPrompt.store";
import { useSession } from "@/components/providers/sessionProvider";
import { AppIcon } from "@/components/ui/appIcon";
import { HeartIcon } from "@/components/ui/icons";
import { Avatar, MediaImage } from "@/components/ui/media";
import { showToast } from "@/components/ui/toast";
import { commentsService } from "@/services/webActions.service";
import { formatCountWithThousandsSuffix, formatTimeSincePosted } from "@/utils/formatDate.util";
import type { Comment, CommentWithReplies } from "@/types";
import { CheckmarkBadge } from "@/components/verification/checkmarkBadge";

import { MentionText } from "@/components/mentions/mentionText";
import { commentVideoReplyHref } from "@/utils/commentVideoReply.util";
import { describeCommentLikeAccessibility } from "./commentLikeAccessibility.util";
import { commentVerificationColor } from "./commentVerificationColor.util";

import { CommentComposer } from "./commentComposer";
import styles from "./commentsPanel.module.css";
import { QuotedPostCard } from "./quotedPostCard";

interface CommentRowProps {
  readonly comment: Comment;
  readonly postId: string;
  readonly postAuthorId?: string;
  readonly isReply: boolean;
  readonly connectBelow?: boolean;
  readonly onReply: (comment: Comment) => void;
  readonly onReplyWithVideo?: (comment: Comment) => void;
}

function CommentRow({ comment, postId, postAuthorId, isReply, connectBelow = false, onReply, onReplyWithVideo }: CommentRowProps) {
  const { viewer } = useSession();
  const queryClient = useQueryClient();
  const [isLiked, setIsLiked] = useState(comment.liked);
  const [likeCount, setLikeCount] = useState(comment.likes);
  const [isReportOpen, setIsReportOpen] = useState(false);
  const [pinOverride, setPinOverride] = useState<boolean | null>(null);
  const optimisticPinned = pinOverride ?? comment.isPinned === true;
  const canPin = postAuthorId !== undefined && viewer?.id === postAuthorId && comment.parentCommentId === null;
  const likeMutation = useMutation({
    mutationFn: (likeNow: boolean) => (likeNow ? commentsService.likeComment(comment.id) : commentsService.unlikeComment(comment.id)),
    onMutate: (likeNow) => {
      setIsLiked(likeNow);
      setLikeCount((count) => Math.max(0, count + (likeNow ? 1 : -1)));
    },
    onError: (_error, likeNow) => {
      setIsLiked(!likeNow);
      setLikeCount((count) => Math.max(0, count + (likeNow ? -1 : 1)));
    },
  });
  const deleteMutation = useMutation({
    mutationFn: () => commentsService.deleteComment(comment.id),
    onSuccess: () => {
      showToast({ text: "Comment deleted" });
      void queryClient.invalidateQueries({ queryKey: ["comments", postId] });
      void queryClient.invalidateQueries({ queryKey: ["commentReplies"] });
    },
  });
  const pinMutation = useMutation({
    mutationFn: async () => {
      if (optimisticPinned) await commentsService.unpinComment(postId, comment.id);
      else await commentsService.pinComment(postId, comment.id);
    },
    onMutate: () => setPinOverride(!optimisticPinned),
    onSuccess: async () => {
      void queryClient.invalidateQueries({ queryKey: ["post-thread", postId] });
      await queryClient.invalidateQueries({ queryKey: ["comments", postId] });
      setPinOverride(null);
    },
    onError: () => {
      setPinOverride(null);
      showToast({ text: "Couldn't update the pin. Try again.", tone: "error" });
    },
  });
  const hideMutation = useMutation({
    mutationFn: () => commentsService.hideComment(postId, comment.id),
    onSuccess: () => {
      showToast({ text: "Comment hidden. Find it in Settings, Hidden comments." });
      void queryClient.invalidateQueries({ queryKey: ["comments", postId] });
      void queryClient.invalidateQueries({ queryKey: ["commentReplies"] });
      void queryClient.invalidateQueries({ queryKey: ["post-thread", postId] });
      void queryClient.invalidateQueries({ queryKey: ["hidden-comments"] });
    },
    onError: () => showToast({ text: "Couldn't hide the comment. Try again.", tone: "error" }),
  });
  const isOwnComment = viewer?.id === comment.author.id;
  const canHide = postAuthorId !== undefined && viewer?.id === postAuthorId && !isOwnComment;
  const isPostAuthor = comment.isPostAuthor ?? (postAuthorId !== undefined && comment.author.id === postAuthorId);
  const displayName = comment.postedAs?.name ?? comment.author.name;
  const displayAvatar = comment.postedAs?.avatarUrl ?? comment.author.avatarUrl;
  const verificationColor = commentVerificationColor(comment);
  const likeAccessibility = describeCommentLikeAccessibility(isLiked, formatCountWithThousandsSuffix(likeCount), displayName);

  return (
    <div className={[styles.comment, isReply ? styles.reply : ""].join(" ")}>
      <span className={styles.avatarRail}>
        <Avatar name={displayName} src={displayAvatar} size={isReply ? "xs" : "sm"} />
        {connectBelow ? <span className={styles.chainLine} aria-hidden="true" /> : null}
      </span>
      <div className={styles.commentBody}>
        <p className={styles.commentMeta}>
          <strong>{displayName}</strong>
          {verificationColor ? <CheckmarkBadge color={verificationColor} /> : null}
          {comment.postedAs ? <span className={styles.profileAttribution}>@{comment.postedAs.handle} · {comment.postedAs.kind}</span> : null}
          {isPostAuthor ? <span className={styles.authorBadge}>Author</span> : null}
          {optimisticPinned ? (
            <span className={styles.pinnedBadge} aria-label="Pinned by author">
              <AppIcon name="pushPin24" size={12} /> Pinned by author
            </span>
          ) : null}
          <span>{formatTimeSincePosted(comment.createdAt)}</span>
        </p>
        <p className={styles.commentText}>
          <MentionText text={comment.text} mentions={comment.mentions} />
        </p>
        {comment.videoReplies?.[0] ? (
          <Link className={styles.videoReplyChip} href={commentVideoReplyHref(comment.videoReplies[0])} aria-label="Replied with video, open the reply">
            <span className={styles.videoReplyThumbnail}>
              <MediaImage src={comment.videoReplies[0].thumbnailUrl} alt="" sizes="28px" />
            </span>
            <span>Replied with video</span>
          </Link>
        ) : null}
        {comment.quotedPost || comment.quotedPostUnavailable ? <QuotedPostCard quoted={comment.quotedPost ?? null} unavailable={!comment.quotedPost} /> : null}
        <div className={styles.commentActions}>
          <button
            type="button"
            className={[styles.commentAction, isLiked ? styles.commentActionActive : ""].join(" ")}
            aria-pressed={likeAccessibility.pressed}
            aria-label={likeAccessibility.label}
            onClick={() => requireAuthThen(() => likeMutation.mutate(!isLiked), "Sign in to like comments.")}
          >
            <HeartIcon size={14} /> {likeCount > 0 ? formatCountWithThousandsSuffix(likeCount) : null}
          </button>
          <button type="button" className={styles.commentAction} onClick={() => requireAuthThen(() => onReply(comment), "Sign in to reply.")}>
            Reply
          </button>
          {onReplyWithVideo && comment.postId === postId && !comment.id.startsWith("pending_") && !comment.videoReplyBlocked ? (
            <button type="button" className={styles.commentAction} onClick={() => onReplyWithVideo(comment)}>
              Reply with video
            </button>
          ) : null}
          {canPin ? (
            <button type="button" className={styles.commentAction} onClick={() => pinMutation.mutate()} disabled={pinMutation.isPending}>
              {optimisticPinned ? "Unpin" : "Pin"}
            </button>
          ) : null}
          {canHide ? (
            <button type="button" className={styles.commentAction} onClick={() => hideMutation.mutate()} disabled={hideMutation.isPending}>
              Hide
            </button>
          ) : null}
          {isOwnComment ? (
            <button type="button" className={styles.commentAction} onClick={() => deleteMutation.mutate()} disabled={deleteMutation.isPending}>
              Delete
            </button>
          ) : (
            <button type="button" className={styles.commentAction} onClick={() => requireAuthThen(() => setIsReportOpen(true), "Sign in to report comments.")}>
              Report
            </button>
          )}
        </div>
      </div>
      <ReportDialog isOpen={isReportOpen} onClose={() => setIsReportOpen(false)} targetType="comment" targetId={comment.id} />
    </div>
  );
}

function CommentBranch({
  comment,
  postId,
  postAuthorId,
  previewPool,
  nestingLevel,
  onReplyWithVideo,
}: {
  readonly comment: Comment;
  readonly postId: string;
  readonly postAuthorId?: string;
  readonly previewPool: readonly Comment[];
  readonly nestingLevel: number;
  readonly onReplyWithVideo?: (comment: Comment) => void;
}) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [replyTarget, setReplyTarget] = useState<Comment | null>(null);
  const [localReplies, setLocalReplies] = useState<readonly Comment[]>([]);
  const previewReplies = previewPool.filter((reply) => reply.parentCommentId === comment.id);
  const repliesQuery = useInfiniteQuery({
    queryKey: ["commentReplies", comment.id],
    queryFn: ({ pageParam }) => commentsService.fetchReplies(comment.id, pageParam),
    initialPageParam: null as string | null,
    getNextPageParam: (lastPage) => lastPage.nextCursor,
    enabled: isExpanded,
  });
  const serverReplies = isExpanded ? (repliesQuery.data?.pages ?? []).flatMap((page) => page.data) : previewReplies;
  const replies = [...serverReplies, ...localReplies.filter((local) => !serverReplies.some((reply) => reply.id === local.id))];
  const isChain = !isExpanded;
  const hiddenReplyCount = isExpanded ? Math.max(0, comment.replyCount - serverReplies.length) : Math.max(0, comment.replyCount - previewReplies.length);
  const canShowMore = isExpanded ? repliesQuery.hasNextPage === true : hiddenReplyCount > 0;
  const showMoreLabel = repliesQuery.isFetching ? "Loading replies…" : isExpanded ? "Show more replies" : `Show ${hiddenReplyCount} more ${hiddenReplyCount === 1 ? "reply" : "replies"}`;
  const branchIndent = nestingLevel > 0 && nestingLevel <= 3 ? 14 : 0;

  return (
    <div className={styles.thread} style={branchIndent ? { marginLeft: branchIndent } : undefined}>
      <CommentRow comment={comment} postId={postId} postAuthorId={postAuthorId} isReply={nestingLevel === 1} connectBelow={isChain && replies.length > 0} onReply={setReplyTarget} onReplyWithVideo={onReplyWithVideo} />
      {replies.map((reply) => (
        <CommentBranch
          key={reply.id}
          comment={reply}
          postId={postId}
          postAuthorId={postAuthorId}
          previewPool={previewPool}
          nestingLevel={nestingLevel + 1}
          onReplyWithVideo={onReplyWithVideo}
        />
      ))}
      {canShowMore ? (
        <button
          type="button"
          className={styles.viewReplies}
          onClick={() => {
            if (repliesQuery.isFetching) return;
            if (!isExpanded) setIsExpanded(true);
            else void repliesQuery.fetchNextPage();
          }}
          disabled={repliesQuery.isFetching}
        >
          {showMoreLabel}
        </button>
      ) : null}
      {replyTarget ? (
        <CommentComposer
          key={replyTarget.id}
          postId={postId}
          parentCommentId={replyTarget.id}
          replyingTo={replyTarget.id === comment.id ? undefined : { userId: replyTarget.author.id, username: replyTarget.author.username }}
          autoFocus
          onPosted={(created) => {
            setReplyTarget(null);
            setLocalReplies((current) => [...current, created]);
          }}
        />
      ) : null}
    </div>
  );
}

export function CommentThread({ comment, postId, postAuthorId, onReplyWithVideo }: { readonly comment: CommentWithReplies; readonly postId: string; readonly postAuthorId?: string; readonly onReplyWithVideo?: (comment: Comment) => void }) {
  return (
    <CommentBranch
      comment={comment}
      postId={postId}
      postAuthorId={postAuthorId}
      previewPool={comment.previewReplies}
      nestingLevel={0}
      onReplyWithVideo={onReplyWithVideo}
    />
  );
}
