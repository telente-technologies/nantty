import { useIsFocused } from "@react-navigation/native";
import { useQuery } from "@tanstack/react-query";
import { useRef, useState } from "react";
import { FlatList, Platform, RefreshControl, Share, StyleSheet, View, type TextInput } from "react-native";

import { useShareToChat } from "@/components/chatSafety/shareToChat.hook";
import { CommentThreadContext, TOP_LEVEL_PARENT_KEY, useCommentThreadController } from "@/components/clips/commentThreadController.hook";
import { ReplyingToCommentLink } from "@/components/clips/videoReply/commentStickerOverlay";
import { PostCard } from "@/components/feed/postCard";
import { ReshareSheet } from "@/components/feed/reshareSheet";
import { ViewQuotesLink } from "@/components/feed/viewQuotesLink";
import { toLocalThreadReply, usePostConversation } from "@/components/feed/thread/postThread.hook";
import { SponsoredThreadItem } from "@/components/feed/thread/sponsoredThreadItem";
import { ThreadComposer } from "@/components/feed/thread/threadComposer";
import { ThreadEmptyState, ThreadErrorState, ThreadSkeleton, ThreadSortDropdown } from "@/components/feed/thread/threadListParts";
import { ThreadReplyBranch } from "@/components/feed/thread/threadReplyBranch";
import { ErrorState } from "@/components/ui/errorState";
import { Header } from "@/components/ui/header";
import { ListSkeleton } from "@/components/ui/listSkeleton";
import { Screen } from "@/components/ui/screen";
import { Text } from "@/components/ui/text";
import { useOpenUserProfile } from "@/hooks/useOpenUserProfile.hook";
import { usePostInteractions } from "@/hooks/usePostInteractions.hook";
import { useScreenshotSharePrompt } from "@/hooks/useScreenshotSharePrompt.hook";
import type { MainScreenProps } from "@/navigation/navigation.types";
import { postsService } from "@/services/content/posts.service";
import { useAuthStore } from "@/store/auth.store";
import { makeThemedStyles, useTheme } from "@/theme";
import type { Post } from "@/types";
import type { ThreadRow, ThreadSort } from "@/types/postThread.type";
import { formatCompactCount } from "@/utils/formatDate.util";
import { requireAuthThen } from "@/utils/requireAuth.util";
import { webAppLinks } from "@/config/webAppLinks.config";

const formatFullTimestamp = (iso: string) => {
  const date = new Date(iso);
  const time = date.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
  const day = date.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
  return `${time} · ${day}`;
};

export function PostDetailScreen({ navigation, route }: MainScreenProps<"PostDetail">) {
  const { colors } = useTheme();
  const styles = useStyles();
  const openUserProfile = useOpenUserProfile();
  const { postId } = route.params;
  const { togglePostLike, followPostAuthor } = usePostInteractions();
  const composerRef = useRef<TextInput>(null);
  const isGuest = useAuthStore((s) => s.status !== "signedIn");
  const post = useQuery({ queryKey: ["post", postId], queryFn: () => postsService.fetchPostById(postId) });
  const isScreenFocused = useIsFocused();
  useScreenshotSharePrompt(post.data, isScreenFocused);
  const [sort, setSort] = useState<ThreadSort>("relevant");
  const [reshareTarget, setReshareTarget] = useState<Post | null>(null);
  const postAuthorId = post.data?.author.id;
  const commentThread = useCommentThreadController(postId, undefined, undefined, postAuthorId);
  const conversation = usePostConversation(postId, sort);
  const { offerSendInChat, sendInChatElement } = useShareToChat();

  const sharePostLink = async () => {
    await Share.share({ message: webAppLinks.post(postId) }).catch(() => undefined);
    postsService.recordPostShare(postId).catch(() => undefined);
  };

  const locallyPostedRows: ThreadRow[] = commentThread
    .locallyPostedCommentsFor(TOP_LEVEL_PARENT_KEY)
    .map((comment) => ({ kind: "reply", key: comment.id, reply: toLocalThreadReply(comment, postAuthorId, false) }));
  const serverIds = new Set(conversation.rows.map((row) => row.key));
  const isPinnedRow = (row: ThreadRow) => row.kind === "reply" && commentThread.applyLocalOverridesToComment(row.reply).isPinned === true;
  const rows = [...locallyPostedRows.filter((row) => !serverIds.has(row.key)), ...conversation.rows]
    .filter((row) => row.kind === "sponsored" || !commentThread.isCommentDeleted(row.reply.id))
    .sort((a, b) => Number(isPinnedRow(b)) - Number(isPinnedRow(a)));
  const threadQuery = conversation.query;

  const postBlock = post.isLoading ? (
    <ListSkeleton rows={1} />
  ) : post.data ? (
    <View>
      {post.data.replyToComment ? (
        <View style={styles.replyLink}>
          <ReplyingToCommentLink clip={post.data} />
        </View>
      ) : null}
      <PostCard
        post={post.data}
        onPressAuthor={() => openUserProfile(post.data!.author.id)}
        onToggleFollow={() => followPostAuthor(post.data!)}
        onToggleLike={() => togglePostLike(post.data!)}
        onPressComments={() => requireAuthThen(() => composerRef.current?.focus(), undefined, "reply")}
        onRepost={() => setReshareTarget(post.data ?? null)}
        onShare={() => offerSendInChat({ kind: "post", id: postId }, sharePostLink)}
        onPressOriginalPost={post.data.resharedFrom ? () => navigation.navigate("PostDetail", { postId: post.data.resharedFrom!.id }) : undefined}
        onPressAnalytics={() => navigation.navigate("PostAnalytics", { postId })}
      />
      <Text size={14} lineHeight={19} color={colors.textMuted} style={styles.timestamp}>
        {formatFullTimestamp(post.data.createdAt)}
        {post.data.views > 0 ? (
          <Text size={14} lineHeight={19} color={colors.textMuted}>
            {" · "}
            <Text size={14} weight={600} lineHeight={19}>
              {formatCompactCount(post.data.views)}
            </Text>{" "}
            Views
          </Text>
        ) : null}
      </Text>
      <View style={styles.threadHeader}>
        <ThreadSortDropdown sort={sort} onChange={setSort} />
        <ViewQuotesLink post={post.data} />
      </View>
    </View>
  ) : (
    <ErrorState message="This post isn't available." onRetry={() => post.refetch()} />
  );

  return (
    <Screen background={colors.surface}>
      <CommentThreadContext.Provider value={commentThread}>
        <View style={styles.flex}>
          <Header title="Post" />
          <FlatList
            style={styles.flex}
            data={post.data ? rows : []}
            keyExtractor={(row) => row.key}
            ListHeaderComponent={postBlock}
            keyboardShouldPersistTaps="handled"
            keyboardDismissMode={Platform.OS === "ios" ? "interactive" : "on-drag"}
            onEndReachedThreshold={0.5}
            onEndReached={conversation.loadNextPage}
            refreshControl={
              <RefreshControl
                refreshing={threadQuery.isRefetching && !threadQuery.isFetchingNextPage}
                onRefresh={() => {
                  post.refetch();
                  threadQuery.refetch();
                }}
                tintColor={colors.primary}
              />
            }
            renderItem={({ item }) =>
              item.kind === "sponsored" ? (
                <SponsoredThreadItem ad={item.ad} postId={postId} />
              ) : (
                <View style={styles.conversation}>
                  <ThreadReplyBranch
                    reply={item.reply}
                    postAuthorId={postAuthorId}
                    hasParentAbove={false}
                    showReplyingTo={false}
                    onRepostReply={() => setReshareTarget(post.data ?? null)}
                  />
                </View>
              )
            }
            ListEmptyComponent={
              !post.data ? null : threadQuery.isLoading ? (
                <ThreadSkeleton />
              ) : threadQuery.isError ? (
                <ThreadErrorState onRetry={() => threadQuery.refetch()} />
              ) : (
                <ThreadEmptyState isGuest={isGuest} />
              )
            }
            ListFooterComponent={threadQuery.isFetchingNextPage ? <ThreadSkeleton rows={1} /> : <View style={styles.footer} />}
          />
          <ThreadComposer
            ref={composerRef}
            postAuthorUsername={post.data?.author.username}
            replyTarget={commentThread.replyTarget}
            onCancelReply={commentThread.cancelReplyingToComment}
            onSubmit={commentThread.submitCommentOrReplyText}
            replyRestriction={post.data?.viewerCanReply === false ? (post.data.replyRestriction ?? null) : null}
          />
          <ReshareSheet post={reshareTarget} onClose={() => setReshareTarget(null)} />
          {sendInChatElement}
        </View>
      </CommentThreadContext.Provider>
    </Screen>
  );
}

const useStyles = makeThemedStyles((colors) =>
  StyleSheet.create({
    flex: { flex: 1 },
    replyLink: { paddingHorizontal: 16, paddingBottom: 12 },
    timestamp: { paddingHorizontal: 16, paddingVertical: 12 },
    threadHeader: { paddingHorizontal: 16, flexDirection: "row", alignItems: "center", justifyContent: "space-between", borderBottomWidth: StyleSheet.hairlineWidth, borderColor: colors.divider },
    conversation: { paddingBottom: 8, borderBottomWidth: StyleSheet.hairlineWidth, borderColor: colors.divider },
    footer: { height: 24 },
  }),
);
