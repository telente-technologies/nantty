import { useEffect, useRef, type ReactElement } from "react";
import { ActivityIndicator, FlatList, Platform, StyleSheet, View, type StyleProp, type ViewStyle } from "react-native";

import { Text } from "@/components/ui/text";
import { makeThemedStyles, useTheme } from "@/theme";
import type { CommentWithReplies } from "@/types";

import { CommentThread } from "./commentThread";
import { TOP_LEVEL_PARENT_KEY, mergeServerAndLocalComments, useCommentThreadContext } from "./commentThreadController.hook";
import { useTopLevelCommentsForPost } from "./postComments.hook";

export interface ThreadedCommentListProps {
  readonly listHeader?: ReactElement | null;
  readonly contentContainerStyle?: StyleProp<ViewStyle>;
  readonly commentHorizontalPadding?: number;
}

export function ThreadedCommentList({ listHeader, contentContainerStyle, commentHorizontalPadding = 0 }: ThreadedCommentListProps) {
  const { colors } = useTheme();
  const styles = useStyles();
  const thread = useCommentThreadContext();
  const { query, topLevelComments, loadNextPageOfTopLevelComments } = useTopLevelCommentsForPost(thread.postId);
  const locallyPostedTopLevel = thread
    .locallyPostedCommentsFor(TOP_LEVEL_PARENT_KEY)
    .map((comment): CommentWithReplies => ({ ...comment, previewReplies: [] }));
  const listRef = useRef<FlatList<CommentWithReplies>>(null);
  const scrolledToCommentId = useRef<string | null>(null);
  const visibleTopLevelComments = mergeServerAndLocalComments(topLevelComments, locallyPostedTopLevel, true)
    .filter((comment) => !thread.isCommentDeleted(comment.id))
    .map((comment) => thread.applyLocalOverridesToComment(comment));
  visibleTopLevelComments.sort((a, b) => Number(b.isPinned === true) - Number(a.isPinned === true));

  const highlightedCommentId = thread.highlightedCommentId;
  const highlightedIndex = highlightedCommentId
    ? visibleTopLevelComments.findIndex((c) => c.id === highlightedCommentId || c.previewReplies.some((r) => r.id === highlightedCommentId))
    : -1;
  useEffect(() => {
    if (!highlightedCommentId || scrolledToCommentId.current === highlightedCommentId) return;
    if (highlightedIndex === -1) {
      if (!query.isLoading) loadNextPageOfTopLevelComments();
      return;
    }
    scrolledToCommentId.current = highlightedCommentId;
    listRef.current?.scrollToIndex({ index: highlightedIndex, viewPosition: 0.2, animated: false });
  }, [highlightedCommentId, highlightedIndex, query.isLoading, topLevelComments.length]);

  return (
    <FlatList
      ref={listRef}
      onScrollToIndexFailed={({ averageItemLength, index }) => listRef.current?.scrollToOffset({ offset: averageItemLength * index, animated: false })}
      style={styles.flex}
      data={visibleTopLevelComments}
      keyExtractor={(comment) => comment.id}
      ListHeaderComponent={listHeader}
      contentContainerStyle={contentContainerStyle}
      keyboardShouldPersistTaps="handled"
      keyboardDismissMode={Platform.OS === "ios" ? "interactive" : "on-drag"}
      onEndReachedThreshold={0.4}
      onEndReached={loadNextPageOfTopLevelComments}
      ItemSeparatorComponent={() => <View style={styles.gap} />}
      ListEmptyComponent={
        query.isLoading ? (
          <ActivityIndicator color={colors.primary} style={styles.status} />
        ) : (
          <Text size={13} color={colors.textMuted} align="center" style={styles.status}>
            {query.isError ? "Couldn’t load comments. Pull to try again." : "No comments yet. Start the conversation."}
          </Text>
        )
      }
      ListFooterComponent={query.isFetchingNextPage ? <ActivityIndicator color={colors.primary} style={styles.status} /> : null}
      refreshing={query.isRefetching && !query.isFetchingNextPage}
      onRefresh={() => query.refetch()}
      renderItem={({ item }) => (
        <View style={{ paddingHorizontal: commentHorizontalPadding }}>
          <CommentThread comment={item} nestingDepth={0} previewReplies={item.previewReplies} />
        </View>
      )}
    />
  );
}

const useStyles = makeThemedStyles((colors) => StyleSheet.create({
  flex: { flex: 1 },
  gap: { height: 20 },
  status: { paddingVertical: 24 },
}));
