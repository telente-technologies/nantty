import { useInfiniteQuery, useQuery } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { Platform, ScrollView, StyleSheet, View } from "react-native";

import { CommentThreadContext, useCommentThreadController } from "@/components/clips/commentThreadController.hook";
import { toLocalThreadReply } from "@/components/feed/thread/postThread.hook";
import { ThreadComposer } from "@/components/feed/thread/threadComposer";
import { ThreadReplyBranch } from "@/components/feed/thread/threadReplyBranch";
import { ThreadSkeleton } from "@/components/feed/thread/threadListParts";
import { PostCard } from "@/components/feed/postCard";
import { ReshareSheet } from "@/components/feed/reshareSheet";
import { ChatTeardropText24Icon } from "@/components/icons";
import { ErrorState } from "@/components/ui/errorState";
import { Header } from "@/components/ui/header";
import { Screen } from "@/components/ui/screen";
import { Text } from "@/components/ui/text";
import { useOpenUserProfile } from "@/hooks/useOpenUserProfile.hook";
import type { MainScreenProps } from "@/navigation/navigation.types";
import { postsService } from "@/services/content/posts.service";
import { postThreadService } from "@/services/content/postThread.service";
import { ApiError } from "@/services/core/apiClient.service";
import { useTheme } from "@/theme";
import type { Post } from "@/types";

const statusOf = (error: unknown) => (error instanceof ApiError ? error.status : null);
const isGoneError = (error: unknown) => {
  const status = statusOf(error);
  return status === 404 || status === 410;
};
const isDeniedError = (error: unknown) => {
  const status = statusOf(error);
  return status === 401 || status === 403;
};

export function CommentThreadScreen({ navigation, route }: MainScreenProps<"CommentThread">) {
  const { colors } = useTheme();
  const styles = useStyles();
  const { commentId, postId } = route.params;
  const openUserProfile = useOpenUserProfile();
  const [reshareTarget, setReshareTarget] = useState<Post | null>(null);
  const [isFocusHighlighted, setIsFocusHighlighted] = useState(true);
  const post = useQuery({ queryKey: ["post", postId], queryFn: () => postsService.fetchPostById(postId) });
  const thread = useInfiniteQuery({
    queryKey: ["comment-thread", commentId],
    queryFn: ({ pageParam }) => postThreadService.fetchCommentThread(commentId, pageParam),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined,
  });
  const postAuthorId = post.data?.author?.id;
  const commentThread = useCommentThreadController(postId, undefined, undefined, postAuthorId);
  const { setReplyThreadVisibility, startReplyingToComment, replyTarget } = commentThread;
  const pages = useMemo(() => thread.data?.pages ?? [], [thread.data?.pages]);
  const ancestors = useMemo(() => pages[0]?.ancestors ?? [], [pages]);
  const subtree = useMemo(() => {
    const seen = new Set<string>();
    return pages
      .flatMap((page) => page.data ?? [])
      .filter((reply) => (seen.has(reply.id) ? false : (seen.add(reply.id), true)));
  }, [pages]);
  const focusComment = pages[0]?.focus ?? null;
  useEffect(() => {
    setReplyThreadVisibility(commentId, "expanded");
  }, [commentId, setReplyThreadVisibility]);
  useEffect(() => {
    if (!focusComment) return;
    const timer = setTimeout(() => setIsFocusHighlighted(false), 3500);
    return () => clearTimeout(timer);
  }, [commentId, focusComment]);
  useEffect(() => {
    if (focusComment && !replyTarget) startReplyingToComment(focusComment, { focus: false });
  }, [focusComment, replyTarget, startReplyingToComment]);

  const initialLoading = thread.isLoading || post.isLoading;
  const retrying = (thread.isFetching || post.isFetching) && !initialLoading;
  const commentGone = isGoneError(thread.error);
  const commentDenied = !commentGone && isDeniedError(thread.error);
  const commentFailed = thread.isError && !commentGone && !commentDenied;
  const commentMissing = !initialLoading && !commentGone && !commentDenied && !commentFailed && !focusComment;
  const showCommentGone = !initialLoading && (commentGone || commentMissing);
  const postGone = isGoneError(post.error);
  const postDenied = !postGone && isDeniedError(post.error);
  const postFailed = post.isError && !postGone && !postDenied;
  const showThreadBody = !initialLoading && !commentGone && !commentDenied && !commentFailed && !commentMissing;
  const retryAll = () => {
    post.refetch();
    thread.refetch();
  };

  return (
    <Screen background={colors.surface}>
      <CommentThreadContext.Provider value={commentThread}>
        <View style={styles.flex}>
          <Header title="Thread" />
          <ScrollView style={styles.flex} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled" keyboardDismissMode={Platform.OS === "ios" ? "interactive" : "on-drag"}>
            {initialLoading ? <ThreadSkeleton rows={2} /> : null}
            {showCommentGone ? (
              <ErrorState kind="contentGone" subject="comment" variant="section" />
            ) : null}
            {commentDenied && !initialLoading ? (
              <ErrorState kind="forbidden" variant="section" title="You can't view this reply" description="You don't have permission to see it." />
            ) : null}
            {commentFailed && !initialLoading ? (
              <ErrorState
                message="Couldn't load this reply."
                detail="Check your connection, then try again."
                onRetry={retryAll}
                retrying={retrying}
              />
            ) : null}
            {!initialLoading && showThreadBody && post.data ? (
              <PostCard
                post={post.data}
                surface="post_detail"
                onPress={() => navigation.navigate("PostDetail", { postId })}
                onPressAuthor={() => openUserProfile(post.data!.author.id)}
                onPressComments={() => navigation.navigate("PostDetail", { postId })}
                onRepost={() => setReshareTarget(post.data ?? null)}
              />
            ) : null}
            {!initialLoading && showThreadBody && postGone ? (
              <View style={styles.postNotice} accessibilityRole="text" accessibilityLabel="This post is no longer available.">
                <ChatTeardropText24Icon size={28} color={colors.textMuted} />
                <Text size={15} weight={600} lineHeight={20} align="center">
                  This post is no longer available.
                </Text>
                <Text size={14} lineHeight={19} color={colors.textMuted} align="center">
                  The original post may have been deleted.
                </Text>
              </View>
            ) : null}
            {!initialLoading && showThreadBody && postDenied ? (
              <View style={styles.postNotice} accessibilityRole="text" accessibilityLabel="You can't view this post.">
                <ChatTeardropText24Icon size={28} color={colors.textMuted} />
                <Text size={15} weight={600} lineHeight={20} align="center">
                  You can&apos;t view this post.
                </Text>
                <Text size={14} lineHeight={19} color={colors.textMuted} align="center">
                  You don&apos;t have permission to see it.
                </Text>
              </View>
            ) : null}
            {!initialLoading && showThreadBody && postFailed ? (
              <ErrorState
                compact
                message="Couldn't load this post."
                detail="Check your connection, then try again."
                onRetry={retryAll}
                retrying={retrying}
              />
            ) : null}
            {showThreadBody
              ? ancestors.map((ancestor, index) => (
                  <ThreadReplyBranch
                    key={ancestor.id}
                    reply={toLocalThreadReply(ancestor, postAuthorId, index > 0)}
                    postAuthorId={postAuthorId}
                    hasParentAbove={index > 0}
                    showReplyingTo
                    onRepostReply={() => setReshareTarget(post.data ?? null)}
                  />
                ))
              : null}
            {showThreadBody && focusComment ? (
              <View style={[styles.focus, isFocusHighlighted && styles.highlightedFocus]}>
                <ThreadReplyBranch
                  reply={toLocalThreadReply(focusComment, postAuthorId, ancestors.length > 0)}
                  postAuthorId={postAuthorId}
                  hasParentAbove={ancestors.length > 0}
                  showReplyingTo
                  onRepostReply={() => setReshareTarget(post.data ?? null)}
                />
              </View>
            ) : null}
            {showThreadBody && subtree.length > 0 ? (
              <View style={styles.repliesHeader}>
                <Text size={13} weight={600} lineHeight={16} color={colors.textMuted}>
                  Replies
                </Text>
              </View>
            ) : null}
            {showThreadBody
              ? subtree.map((reply) => (
                  <ThreadReplyBranch
                    key={reply.id}
                    reply={reply}
                    postAuthorId={postAuthorId}
                    hasParentAbove={false}
                    showReplyingTo={false}
                    onRepostReply={() => setReshareTarget(post.data ?? null)}
                  />
                ))
              : null}
            {showThreadBody && thread.hasNextPage && !thread.isFetchingNextPage ? (
              <Text size={14} weight={500} lineHeight={18} color={colors.primary} accessibilityRole="button" onPress={() => thread.fetchNextPage()} style={styles.loadMore}>
                Show more replies
              </Text>
            ) : null}
          </ScrollView>
          <ThreadComposer
            postAuthorUsername={focusComment?.author?.username}
            replyTarget={replyTarget ?? focusComment}
            focusRequest={commentThread.replyFocusRequest}
            onCancelReply={() => (focusComment ? startReplyingToComment(focusComment, { focus: false }) : undefined)}
            onSubmit={commentThread.submitCommentOrReplyText}
            replyRestriction={post.data?.viewerCanReply === false ? (post.data.replyRestriction ?? null) : null}
          />
          <ReshareSheet post={reshareTarget} onClose={() => setReshareTarget(null)} />
        </View>
      </CommentThreadContext.Provider>
    </Screen>
  );
}

const useStyles = () => {
  const { colors } = useTheme();
  return StyleSheet.create({
    flex: { flex: 1 },
    content: { paddingBottom: 24 },
    focus: { borderTopWidth: StyleSheet.hairlineWidth, borderBottomWidth: StyleSheet.hairlineWidth, borderColor: colors.divider },
    highlightedFocus: { backgroundColor: colors.chip },
    repliesHeader: { paddingHorizontal: 16, paddingTop: 12 },
    loadMore: { paddingHorizontal: 16, paddingVertical: 12 },
    postNotice: { paddingHorizontal: 32, paddingVertical: 24, gap: 8, alignItems: "center" },
  });
};
