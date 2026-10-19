import { useEffect, useRef, useState, type ReactElement } from "react";
import { FlatList, Platform, StyleSheet, View, type StyleProp, type ViewStyle } from "react-native";

import { BrandLoader } from "@/components/ui/brandLoader";
import { Text } from "@/components/ui/text";
import { makeThemedStyles, useTheme } from "@/theme";
import type { CommentWithReplies } from "@/types";
import { CommentSectionFilterTabs, hasQuotesToShow, QuoteThreadItemRow } from "@/components/feed/thread/quoteThreadItem";
import { isQuoteThreadItem, type CommentSectionFilter } from "@/types/postThread.type";

import { CommentThread } from "./commentThread";
import { TOP_LEVEL_PARENT_KEY, mergeServerAndLocalComments, useCommentThreadContext } from "./commentThreadController.hook";
import { useTopLevelCommentsForPost, type CommentSectionItem } from "./postComments.hook";

export interface ThreadedCommentListProps {
  readonly listHeader?: ReactElement | null;
  readonly contentContainerStyle?: StyleProp<ViewStyle>;
  readonly commentHorizontalPadding?: number;
  readonly quoteCount?: number;
  readonly onOpenQuote?: (quotePostId: string) => void;
}

export function ThreadedCommentList({ listHeader, contentContainerStyle, commentHorizontalPadding = 0, quoteCount, onOpenQuote }: ThreadedCommentListProps) {
  const { colors } = useTheme();
  const styles = useStyles();
  const thread = useCommentThreadContext();
  const listRef = useRef<FlatList<CommentSectionItem>>(null);
  const [chosenFilter, setFilter] = useState<CommentSectionFilter>("all");
  const filter: CommentSectionFilter = hasQuotesToShow(quoteCount) ? chosenFilter : "all";
  const { query, items, topLevelComments, loadNextPageOfTopLevelComments, isRestartingFromTop } = useTopLevelCommentsForPost(
    thread.postId,
    () => listRef.current?.scrollToOffset({ offset: 0, animated: false }),
    filter,
  );
  const locallyPostedTopLevel = thread
    .locallyPostedCommentsFor(TOP_LEVEL_PARENT_KEY)
    .map((comment): CommentWithReplies => ({ ...comment, previewReplies: [] }));
  const scrolledToCommentId = useRef<string | null>(null);
  const visibleTopLevelComments = mergeServerAndLocalComments(topLevelComments, filter === "quotes" ? [] : locallyPostedTopLevel, true)
    .filter((comment) => !thread.isCommentDeleted(comment.id))
    .map((comment) => thread.applyLocalOverridesToComment(comment));
  const commentsById = new Map(visibleTopLevelComments.map((comment) => [comment.id, comment]));
  const serverIds = new Set(topLevelComments.map((comment) => comment.id));
  const serverOrdered = items.flatMap((item): CommentSectionItem[] => (isQuoteThreadItem(item) ? [item] : commentsById.has(item.id) ? [commentsById.get(item.id)!] : []));
  const visibleItems: CommentSectionItem[] = [...visibleTopLevelComments.filter((comment) => !serverIds.has(comment.id)), ...serverOrdered];
  visibleItems.sort((a, b) => Number(!isQuoteThreadItem(b) && b.isPinned === true) - Number(!isQuoteThreadItem(a) && a.isPinned === true));

  const highlightedCommentId = thread.highlightedCommentId;
  const highlightedIndex = highlightedCommentId
    ? visibleItems.findIndex((c) => !isQuoteThreadItem(c) && (c.id === highlightedCommentId || c.previewReplies.some((r) => r.id === highlightedCommentId)))
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
      data={visibleItems}
      keyExtractor={(item) => (isQuoteThreadItem(item) ? `quote-${item.id}` : item.id)}
      ListHeaderComponent={
        <View style={{ paddingHorizontal: commentHorizontalPadding }}>
          {listHeader}
          <CommentSectionFilterTabs filter={filter} onChange={setFilter} quoteCount={quoteCount} />
        </View>
      }
      contentContainerStyle={contentContainerStyle}
      keyboardShouldPersistTaps="handled"
      keyboardDismissMode={Platform.OS === "ios" ? "interactive" : "on-drag"}
      onEndReachedThreshold={0.4}
      onEndReached={loadNextPageOfTopLevelComments}
      ItemSeparatorComponent={() => <View style={styles.gap} />}
      ListEmptyComponent={
        query.isLoading ? (
          <BrandLoader size="md" style={styles.status} />
        ) : (
          <Text size={13} color={colors.textMuted} align="center" style={styles.status}>
            {query.isError && !isRestartingFromTop ? "Couldn’t load comments. Pull to try again." : filter === "quotes" ? "No quotes yet." : "No comments yet. Start the conversation."}
          </Text>
        )
      }
      ListFooterComponent={query.isFetchingNextPage ? <BrandLoader size="sm" style={styles.status} /> : null}
      refreshing={query.isRefetching && !query.isFetchingNextPage}
      onRefresh={() => query.refetch()}
      renderItem={({ item }) => (
        <View style={{ paddingHorizontal: commentHorizontalPadding }}>
          {isQuoteThreadItem(item) ? (
            <QuoteThreadItemRow item={item} onOpen={(quotePostId) => onOpenQuote?.(quotePostId)} />
          ) : (
            <CommentThread comment={item} nestingDepth={0} previewReplies={item.previewReplies} />
          )}
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
