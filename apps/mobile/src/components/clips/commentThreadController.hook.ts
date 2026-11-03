import { createContext, useCallback, useContext, useEffect, useState } from "react";

import { postCommentsService } from "@/services/content/postComments.service";
import { useAuthStore } from "@/store/auth.store";
import type { Comment, ID, QuotedPostSummary, UserSummary } from "@/types";
import type { ActingProfile } from "@/types/brand.type";
import type { MentionEntity } from "@/types/mention.type";
import { showAlertWithButtons } from "@/utils/crossPlatformAlert.util";
import { canReplyWithVideo } from "./videoReply/videoReply.util";
import { requireAuthAfterClosingModal, requireAuthThen } from "@/utils/requireAuth.util";

export const TOP_LEVEL_PARENT_KEY = "root";
export type ReplyThreadVisibility = "expanded" | "collapsed";

interface LikeOverride {
  readonly liked: boolean;
  readonly likes: number;
}

interface CommentThreadLocalState {
  readonly locallyPostedCommentsByParentKey: Record<string, readonly Comment[]>;
  readonly likeOverridesByCommentId: Record<string, LikeOverride>;
  readonly pinOverridesByCommentId: Record<string, boolean>;
  readonly deletedCommentIds: Record<string, true>;
  readonly replyThreadVisibilityByCommentId: Record<string, ReplyThreadVisibility>;
  readonly replyTarget: Comment | null;
}

const EMPTY_THREAD_STATE: CommentThreadLocalState = {
  locallyPostedCommentsByParentKey: {},
  likeOverridesByCommentId: {},
  pinOverridesByCommentId: {},
  deletedCommentIds: {},
  replyThreadVisibilityByCommentId: {},
  replyTarget: null,
};

const FALLBACK_SIGNED_IN_AUTHOR: UserSummary = { id: "u_me", name: "You", username: "you", avatarUrl: null, verified: false };

export interface CommentQuoteOptions {
  readonly quotedPostId: ID | null | undefined;
  readonly quotedPost: QuotedPostSummary | null;
}

export const isPendingComment = (comment: Comment) => comment.id.startsWith("pending_");

export interface VideoReplyOptions {
  readonly clipAuthorId: string | null | undefined;
  readonly onStartVideoReply: (comment: Comment) => void;
}

export function useCommentThreadController(postId: string | null, closeContainingModal?: () => void, videoReply?: VideoReplyOptions, postAuthorId?: string | null) {
  const signedInUser = useAuthStore((s) => s.user);
  const [isPickingVideoReplyComment, setIsPickingVideoReplyComment] = useState(false);
  const [highlightedCommentId, setHighlightedCommentId] = useState<string | null>(null);
  const signedInAuthor: UserSummary = signedInUser ?? FALLBACK_SIGNED_IN_AUTHOR;
  const [threadState, setThreadState] = useState<CommentThreadLocalState>(EMPTY_THREAD_STATE);
  const [replyFocusRequest, setReplyFocusRequest] = useState(0);

  useEffect(() => {
    setThreadState(EMPTY_THREAD_STATE);
    setIsPickingVideoReplyComment(false);
    setHighlightedCommentId(null);
  }, [postId]);

  const canReplyWithVideoTo = (comment: Comment) => !!videoReply && canReplyWithVideo(comment, videoReply.clipAuthorId, signedInUser?.id ?? null);
  const startVideoReplyTo = (comment: Comment) => {
    if (!canReplyWithVideoTo(comment)) return;
    setIsPickingVideoReplyComment(false);
    videoReply?.onStartVideoReply(comment);
  };

  const applyLocalOverridesToComment = useCallback(
    <T extends Comment>(comment: T): T => {
      const override = threadState.likeOverridesByCommentId[comment.id];
      const pinOverride = threadState.pinOverridesByCommentId[comment.id];
      const pinnedByAnotherOverride = pinOverride === undefined && Object.values(threadState.pinOverridesByCommentId).some((pinned) => pinned);
      const withLike = override ? { ...comment, ...override } : comment;
      if (pinOverride !== undefined) return { ...withLike, isPinned: pinOverride };
      if (pinnedByAnotherOverride && comment.isPinned) return { ...withLike, isPinned: false };
      return withLike;
    },
    [threadState.likeOverridesByCommentId, threadState.pinOverridesByCommentId],
  );

  const setLikeOverride = (commentId: string, override: LikeOverride) =>
    setThreadState((s) => ({ ...s, likeOverridesByCommentId: { ...s.likeOverridesByCommentId, [commentId]: override } }));

  const applyCommentLikeToggle = (comment: Comment) => {
    if (isPendingComment(comment)) return;
    const current = applyLocalOverridesToComment(comment);
    const previous = { liked: current.liked, likes: current.likes };
    setLikeOverride(comment.id, { liked: !current.liked, likes: current.likes + (current.liked ? -1 : 1) });
    const request = current.liked ? postCommentsService.unlikeComment(comment.id) : postCommentsService.likeComment(comment.id);
    request.catch(() => setLikeOverride(comment.id, previous));
  };

  const replaceLocallyPostedComment = (parentKey: string, pendingId: string, replacement: Comment | null) =>
    setThreadState((s) => {
      const existing = s.locallyPostedCommentsByParentKey[parentKey] ?? [];
      const updated = replacement ? existing.map((c) => (c.id === pendingId ? replacement : c)) : existing.filter((c) => c.id !== pendingId);
      return { ...s, locallyPostedCommentsByParentKey: { ...s.locallyPostedCommentsByParentKey, [parentKey]: updated } };
    });

  const applyCommentOrReplyText = (text: string, mentions: readonly MentionEntity[], quote?: CommentQuoteOptions, asProfile?: ActingProfile) => {
    if (!postId || !text.trim()) return;
    const parent = threadState.replyTarget;
    const parentKey = parent?.id ?? TOP_LEVEL_PARENT_KEY;
    const pendingComment: Comment = {
      id: `pending_${Date.now().toString(36)}`,
      postId,
      parentCommentId: parent?.id ?? null,
      rootCommentId: parent ? (parent.rootCommentId ?? parent.id) : null,
      author: signedInAuthor,
      postedAs: asProfile ? { id: asProfile.id, kind: asProfile.kind, name: asProfile.name, handle: asProfile.handle, avatarUrl: asProfile.avatarUrl } : null,
      text: text.trim(),
      mentions,
      createdAt: new Date().toISOString(),
      likes: 0,
      liked: false,
      bookmarked: false,
      replyCount: 0,
      replyingTo: parent ? { userId: parent.author.id, username: parent.author.username } : undefined,
      isPostAuthor: !!postAuthorId && signedInAuthor.id === postAuthorId,
      quotedPost: quote?.quotedPostId ? quote.quotedPost : null,
    };
    setThreadState((s) => ({
      ...s,
      replyTarget: null,
      locallyPostedCommentsByParentKey: {
        ...s.locallyPostedCommentsByParentKey,
        [parentKey]: parent
          ? [...(s.locallyPostedCommentsByParentKey[parentKey] ?? []), pendingComment]
          : [pendingComment, ...(s.locallyPostedCommentsByParentKey[parentKey] ?? [])],
      },
    }));
    postCommentsService
      .addCommentToPost(postId, { text: pendingComment.text, parentCommentId: parent?.id, mentions, ...(quote?.quotedPostId === undefined ? {} : { quotedPostId: quote.quotedPostId }), ...(asProfile === undefined ? {} : { asProfileId: asProfile.id }) })
      .then((savedComment) => replaceLocallyPostedComment(parentKey, pendingComment.id, savedComment))
      .catch(() => {
        replaceLocallyPostedComment(parentKey, pendingComment.id, null);
        showAlertWithButtons("Comment not posted", "Please check your connection and try again.");
      });
  };

  const requireSignInFor = (action: () => void, reason: string) =>
    closeContainingModal ? requireAuthAfterClosingModal(closeContainingModal, action, reason) : requireAuthThen(action, undefined, reason);

  const toggleLikeOnComment = (comment: Comment) => requireSignInFor(() => applyCommentLikeToggle(comment), "like comments");
  const submitCommentOrReplyText = (text: string, mentions: readonly MentionEntity[] = [], quote?: CommentQuoteOptions, asProfile?: ActingProfile) => {
    if (!postId || !text.trim()) return;
    requireSignInFor(() => applyCommentOrReplyText(text, mentions, quote, asProfile), "comment");
  };

  const setDeletedFlag = (commentId: string, deleted: boolean) =>
    setThreadState((s) => {
      const deletedCommentIds = { ...s.deletedCommentIds };
      if (deleted) deletedCommentIds[commentId] = true;
      else delete deletedCommentIds[commentId];
      return { ...s, deletedCommentIds };
    });

  const deleteOwnComment = (comment: Comment) => {
    if (comment.author.id !== signedInAuthor.id || isPendingComment(comment)) return;
    setDeletedFlag(comment.id, true);
    postCommentsService.deleteComment(comment.id).catch(() => {
      setDeletedFlag(comment.id, false);
      showAlertWithButtons("Could not delete comment", "Please try again.");
    });
  };

  const canPinComment = (comment: Comment) =>
    !isPendingComment(comment) && comment.parentCommentId === null && !!postAuthorId && signedInUser?.id === postAuthorId;

  const togglePinOnComment = (comment: Comment) => {
    if (!postId || !canPinComment(comment)) return;
    const pinning = !(applyLocalOverridesToComment(comment).isPinned === true);
    setThreadState((s) => ({
      ...s,
      pinOverridesByCommentId: {
        ...(pinning ? Object.fromEntries(Object.keys(s.pinOverridesByCommentId).map((commentId) => [commentId, false])) : s.pinOverridesByCommentId),
        [comment.id]: pinning,
      },
    }));
    const request = pinning ? postCommentsService.pinComment(postId, comment.id) : postCommentsService.unpinComment(postId, comment.id);
    request.catch(() => {
      setThreadState((s) => ({ ...s, pinOverridesByCommentId: { ...s.pinOverridesByCommentId, [comment.id]: !pinning } }));
      showAlertWithButtons(pinning ? "Could not pin comment" : "Could not unpin comment", "Please try again.");
    });
  };

  const canHideComment = (comment: Comment) =>
    !isPendingComment(comment) && !!postAuthorId && signedInUser?.id === postAuthorId && comment.author.id !== postAuthorId;

  const hideComment = (comment: Comment) => {
    if (!postId || !canHideComment(comment)) return;
    setDeletedFlag(comment.id, true);
    postCommentsService.hideComment(postId, comment.id).catch(() => {
      setDeletedFlag(comment.id, false);
      showAlertWithButtons("Could not hide comment", "Please try again.");
    });
  };

  const setReplyThreadVisibility = useCallback(
    (commentId: string, visibility: ReplyThreadVisibility) =>
      setThreadState((s) =>
        s.replyThreadVisibilityByCommentId[commentId] === visibility
          ? s
          : { ...s, replyThreadVisibilityByCommentId: { ...s.replyThreadVisibilityByCommentId, [commentId]: visibility } },
      ),
    [],
  );

  const startReplyingToComment = useCallback((comment: Comment, options: { readonly focus?: boolean } = {}) => {
    if (isPendingComment(comment)) return;
    setThreadState((s) => (s.replyTarget?.id === comment.id ? s : { ...s, replyTarget: comment }));
    if (options.focus !== false) setReplyFocusRequest((n) => n + 1);
  }, []);
  const cancelReplyingToComment = useCallback(() => setThreadState((s) => (s.replyTarget ? { ...s, replyTarget: null } : s)), []);

  const locallyPostedCommentsFor = (parentKey: string) => threadState.locallyPostedCommentsByParentKey[parentKey] ?? [];
  const isCommentDeleted = (commentId: string) => !!threadState.deletedCommentIds[commentId];
  const replyThreadVisibilityFor = (commentId: string): ReplyThreadVisibility | undefined => threadState.replyThreadVisibilityByCommentId[commentId];
  const canDeleteComment = (comment: Comment) => comment.author.id === signedInAuthor.id && !isPendingComment(comment);

  return {
    postId,
    canReplyWithVideoTo,
    startVideoReplyTo,
    isPickingVideoReplyComment,
    setIsPickingVideoReplyComment,
    highlightedCommentId,
    setHighlightedCommentId,
    replyTarget: threadState.replyTarget,
    replyFocusRequest,
    applyLocalOverridesToComment,
    toggleLikeOnComment,
    submitCommentOrReplyText,
    deleteOwnComment,
    canDeleteComment,
    canPinComment,
    togglePinOnComment,
    canHideComment,
    hideComment,
    setReplyThreadVisibility,
    replyThreadVisibilityFor,
    startReplyingToComment,
    cancelReplyingToComment,
    locallyPostedCommentsFor,
    isCommentDeleted,
  };
}

export type CommentThreadController = ReturnType<typeof useCommentThreadController>;

export const CommentThreadContext = createContext<CommentThreadController | null>(null);

export function useCommentThreadContext(): CommentThreadController {
  const controller = useContext(CommentThreadContext);
  if (!controller) throw new Error("useCommentThreadContext must be used inside CommentThreadContext.Provider");
  return controller;
}

export const mergeServerAndLocalComments = <T extends Comment>(
  serverComments: readonly T[],
  localComments: readonly T[],
  placeLocalFirst: boolean,
): T[] => {
  const serverIds = new Set(serverComments.map((c) => c.id));
  const localOnly = localComments.filter((c) => !serverIds.has(c.id));
  return placeLocalFirst ? [...localOnly, ...serverComments] : [...serverComments, ...localOnly];
};
