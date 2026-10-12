"use client";

import { useInfiniteQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";

import { ReportDialog } from "@/components/actions/reportDialog";
import { requireAuthThen } from "@/components/auth/authPrompt.store";
import { useSession } from "@/components/providers/sessionProvider";
import { AppIcon } from "@/components/ui/appIcon";
import { HeartIcon } from "@/components/ui/icons";
import { Avatar } from "@/components/ui/media";
import { showToast } from "@/components/ui/toast";
import { commentsService } from "@/services/webActions.service";
import { formatCountWithThousandsSuffix, formatTimeSincePosted } from "@/utils/formatDate.util";
import type { Comment, CommentWithReplies } from "@/types";

import { MentionText } from "@/components/mentions/mentionText";

import { CommentComposer } from "./commentComposer";
import styles from "./commentsPanel.module.css";
import { QuotedPostCard } from "./quotedPostCard";
import { countRepliesHiddenFromChain } from "@/utils/commentChain.util";

interface CommentRowProps {
  readonly comment: Comment;
  readonly postId: string;
  readonly postAuthorId?: string;
  readonly isReply: boolean;
  readonly connectBelow?: boolean;
  readonly onReply: (comment: Comment) => void;
}

function CommentRow({ comment, postId, postAuthorId, isReply, connectBelow = false, onReply }: CommentRowProps) {
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

  return (
    <div className={[styles.comment, isReply ? styles.reply : ""].join(" ")}>
      <span className={styles.avatarRail}>
        <Avatar name={comment.author.name} src={comment.author.avatarUrl} size={isReply ? "xs" : "sm"} />
        {connectBelow ? <span className={styles.chainLine} aria-hidden="true" /> : null}
      </span>
      <div className={styles.commentBody}>
        <p className={styles.commentMeta}>
          <strong>{comment.author.name}</strong>
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
        {comment.quotedPost || comment.quotedPostUnavailable ? <QuotedPostCard quoted={comment.quotedPost ?? null} unavailable={!comment.quotedPost} /> : null}
        <div className={styles.commentActions}>
          <button
            type="button"
            className={[styles.commentAction, isLiked ? styles.commentActionActive : ""].join(" ")}
            aria-pressed={isLiked}
            aria-label={`Like comment by ${comment.author.name}`}
            onClick={() => requireAuthThen(() => likeMutation.mutate(!isLiked), "Sign in to like comments.")}
          >
            <HeartIcon size={14} /> {likeCount > 0 ? formatCountWithThousandsSuffix(likeCount) : null}
          </button>
          <button type="button" className={styles.commentAction} onClick={() => requireAuthThen(() => onReply(comment), "Sign in to reply.")}>
            Reply
          </button>
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

export function CommentThread({ comment, postId, postAuthorId }: { readonly comment: CommentWithReplies; readonly postId: string; readonly postAuthorId?: string }) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [replyTarget, setReplyTarget] = useState<Comment | null>(null);
  const [localReplies, setLocalReplies] = useState<readonly Comment[]>([]);
  const repliesQuery = useInfiniteQuery({
    queryKey: ["commentReplies", comment.id],
    queryFn: ({ pageParam }) => commentsService.fetchReplies(comment.id, pageParam),
    initialPageParam: null as string | null,
    getNextPageParam: (lastPage) => lastPage.nextCursor,
    enabled: isExpanded,
  });
  const serverReplies = isExpanded ? (repliesQuery.data?.pages ?? []).flatMap((page) => page.data) : comment.previewReplies;
  const replies = [...serverReplies, ...localReplies.filter((local) => !serverReplies.some((reply) => reply.id === local.id))];
  const isChain = !isExpanded;
  const hiddenReplyCount = isExpanded ? Math.max(0, comment.replyCount - serverReplies.length) : countRepliesHiddenFromChain(comment, comment.previewReplies);
  const canShowMore = isExpanded ? repliesQuery.hasNextPage === true : hiddenReplyCount > 0;
  const showMoreLabel = repliesQuery.isFetching ? "Loading replies…" : isExpanded ? "Show more replies" : `Show ${hiddenReplyCount} more ${hiddenReplyCount === 1 ? "reply" : "replies"}`;

  return (
    <div className={styles.thread}>
      <CommentRow comment={comment} postId={postId} postAuthorId={postAuthorId} isReply={false} connectBelow={isChain && replies.length > 0} onReply={setReplyTarget} />
      {replies.map((reply, index) => (
        <CommentRow key={reply.id} comment={reply} postId={postId} postAuthorId={postAuthorId} isReply={!isChain} connectBelow={isChain && index < replies.length - 1} onReply={setReplyTarget} />
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
          parentCommentId={comment.id}
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
