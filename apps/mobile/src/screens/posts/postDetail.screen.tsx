import { useIsFocused } from "@react-navigation/native";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { FlatList, Platform, RefreshControl, Share, StyleSheet, View, type TextInput } from "react-native";

import { useShareToChat } from "@/components/chatSafety/shareToChat.hook";
import { CommentThreadContext, TOP_LEVEL_PARENT_KEY, useCommentThreadController } from "@/components/clips/commentThreadController.hook";
import { ReplyingToCommentLink } from "@/components/clips/videoReply/commentStickerOverlay";
import { PostCard } from "@/components/feed/postCard";
import { ReshareSheet } from "@/components/feed/reshareSheet";
import { toLocalThreadReply, usePostConversation } from "@/components/feed/thread/postThread.hook";
import { CommentSectionFilterTabs, hasQuotesToShow, QuoteThreadItemRow } from "@/components/feed/thread/quoteThreadItem";
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
import type { CommentSectionFilter, ThreadRow, ThreadSort } from "@/types/postThread.type";
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
  const { postId, highlight = false } = route.params;
  const [isPostHighlighted, setIsPostHighlighted] = useState(highlight);
  const { togglePostLike, followPostAuthor } = usePostInteractions();
  const composerRef = useRef<TextInput>(null);
  const isGuest = useAuthStore((s) => s.status !== "signedIn");
  const post = useQuery({ queryKey: ["post", postId], queryFn: () => postsService.fetchPostById(postId) });
  const isScreenFocused = useIsFocused();
  useScreenshotSharePrompt(post.data, isScreenFocused);
  const [sort, setSort] = useState<ThreadSort>("relevant");
  const [chosenFilter, setFilter] = useState<CommentSectionFilter>("all");
  const filter: CommentSectionFilter = hasQuotesToShow(post.data?.quotes) ? chosenFilter : "all";
  const [reshareTarget, setReshareTarget] = useState<Post | null>(null);
  const postAuthorId = post.data?.author.id;
  const commentThread = useCommentThreadController(postId, undefined, undefined, postAuthorId);
  const threadListRef = useRef<FlatList<ThreadRow>>(null);
  const conversation = usePostConversation(postId, sort, () => threadListRef.current?.scrollToOffset({ offset: 0, animated: false }), filter);
  const { offerSendInChat, sendInChatElement } = useShareToChat();

  useEffect(() => {
    if (!highlight || !post.data) return;
    const timer = setTimeout(() => setIsPostHighlighted(false), 3500);
    return () => clearTimeout(timer);
  }, [highlight, post.data, postId]);

  const sharePostLink = async () => {
    await Share.share({ message: webAppLinks.post(postId) }).catch(() => undefined);
    postsService.recordPostShare(postId).catch(() => undefined);
  };

  const locallyPostedRows: ThreadRow[] = filter === "quotes" ? [] : commentThread
    .locallyPostedCommentsFor(TOP_LEVEL_PARENT_KEY)
    .map((comment) => ({ kind: "reply", key: comment.id, reply: toLocalThreadReply(comment, postAuthorId, false) }));
  const serverIds = new Set(conversation.rows.map((row) => row.key));
  const isPinnedRow = (row: ThreadRow) => row.kind === "reply" && commentThread.applyLocalOverridesToComment(row.reply).isPinned === true;
  const rows = [...locallyPostedRows.filter((row) => !serverIds.has(row.key)), ...conversation.rows]
    .filter((row) => row.kind !== "reply" || !commentThread.isCommentDeleted(row.reply.id))
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
      <View style={isPostHighlighted ? styles.highlightedPost : undefined}>
      <PostCard
        post={post.data}
        surface="post_detail"
        onPressAuthor={() => openUserProfile(post.data!.author.id)}
        onToggleFollow={() => followPostAuthor(post.data!)}
        onToggleLike={() => togglePostLike(post.data!)}
        onPressComments={() => requireAuthThen(() => composerRef.current?.focus(), undefined, "reply")}
        onRepost={() => setReshareTarget(post.data ?? null)}
        onShare={() => offerSendInChat({ kind: "post", id: postId }, sharePostLink)}
        onPressOriginalPost={post.data.resharedFrom ? () => navigation.navigate("PostDetail", { postId: post.data.resharedFrom!.id }) : undefined}
        onPressAnalytics={() => navigation.navigate("PostAnalytics", { postId })}
      />
      </View>
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
        <CommentSectionFilterTabs filter={filter} onChange={setFilter} quoteCount={post.data.quotes} />
        {filter === "all" ? <ThreadSortDropdown sort={sort} onChange={setSort} /> : null}
      </View>
    </View>
  ) : (
    <ErrorState error={post.error} message="This post isn't available." onRetry={() => post.refetch()} />
  );

  return (
    <Screen background={colors.surface}>
      <CommentThreadContext.Provider value={commentThread}>
        <View style={styles.flex}>
          <Header title="Post" />
          <FlatList
            ref={threadListRef}
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
                colors={[colors.primary]}
              />
            }
            renderItem={({ item }) =>
              item.kind === "sponsored" ? (
                <SponsoredThreadItem ad={item.ad} postId={postId} />
              ) : item.kind === "quote" ? (
                <View style={[styles.conversation, styles.quote]}>
                  <QuoteThreadItemRow item={item.quote} onOpen={(quotePostId) => navigation.push("PostDetail", { postId: quotePostId })} />
                </View>
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
              ) : threadQuery.isError && !conversation.isRestartingFromTop ? (
                <ThreadErrorState onRetry={() => threadQuery.refetch()} />
              ) : filter === "quotes" ? (
                <Text size={14} lineHeight={19} color={colors.textMuted} align="center" style={styles.emptyQuotes}>
                  No quotes yet.
                </Text>
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
            focusRequest={commentThread.replyFocusRequest}
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
    highlightedPost: { marginHorizontal: 8, borderWidth: 1, borderColor: colors.textMuted, borderRadius: 10, overflow: "hidden" },
    threadHeader: { paddingHorizontal: 16, flexDirection: "row", alignItems: "center", justifyContent: "space-between", borderBottomWidth: StyleSheet.hairlineWidth, borderColor: colors.divider },
    conversation: { paddingBottom: 8, borderBottomWidth: StyleSheet.hairlineWidth, borderColor: colors.divider },
    footer: { height: 24 },
    quote: { paddingHorizontal: 16, paddingTop: 12 },
    emptyQuotes: { paddingVertical: 32 },
  }),
);
