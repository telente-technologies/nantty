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

function CommentRow({ comment, postId, postAuthorId, isReply, onReply }: { readonly comment: Comment; readonly postId: string; readonly postAuthorId?: string; readonly isReply: boolean; readonly onReply: (comment: Comment) => void }) {
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
  const isOwnComment = viewer?.id === comment.author.id;

  return (
    <div className={[styles.comment, isReply ? styles.reply : ""].join(" ")}>
      <Avatar name={comment.author.name} src={comment.author.avatarUrl} size={isReply ? "xs" : "sm"} />
      <div className={styles.commentBody}>
        <p className={styles.commentMeta}>
          <strong>{comment.author.name}</strong>
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
  const repliesQuery = useInfiniteQuery({
    queryKey: ["commentReplies", comment.id],
    queryFn: ({ pageParam }) => commentsService.fetchReplies(comment.id, pageParam),
    initialPageParam: null as string | null,
    getNextPageParam: (lastPage) => lastPage.nextCursor,
    enabled: isExpanded,
  });
  const replies = isExpanded ? (repliesQuery.data?.pages ?? []).flatMap((page) => page.data) : comment.previewReplies;
  const hiddenReplyCount = Math.max(0, comment.replyCount - replies.length);

  return (
    <div className={styles.thread}>
      <CommentRow comment={comment} postId={postId} postAuthorId={postAuthorId} isReply={false} onReply={setReplyTarget} />
      {replies.map((reply) => (
        <CommentRow key={reply.id} comment={reply} postId={postId} postAuthorId={postAuthorId} isReply onReply={setReplyTarget} />
      ))}
      {hiddenReplyCount > 0 || (isExpanded && repliesQuery.hasNextPage) ? (
        <button
          type="button"
          className={styles.viewReplies}
          onClick={() => (isExpanded ? repliesQuery.fetchNextPage() : setIsExpanded(true))}
          disabled={repliesQuery.isFetching}
        >
          {repliesQuery.isFetching ? "Loading replies…" : `View ${hiddenReplyCount > 0 ? hiddenReplyCount : "more"} ${hiddenReplyCount === 1 ? "reply" : "replies"}`}
        </button>
      ) : null}
      {replyTarget ? (
        <CommentComposer
          key={replyTarget.id}
          postId={postId}
          parentCommentId={comment.id}
          replyingTo={replyTarget.id === comment.id ? undefined : { userId: replyTarget.author.id, username: replyTarget.author.username }}
          autoFocus
          onPosted={() => {
            setReplyTarget(null);
            setIsExpanded(true);
          }}
        />
      ) : null}
    </div>
  );
}
