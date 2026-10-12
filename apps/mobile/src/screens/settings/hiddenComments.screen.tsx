import { useInfiniteQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { FlatList, StyleSheet, View } from "react-native";

import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/emptyState";
import { ErrorState } from "@/components/ui/errorState";
import { Header } from "@/components/ui/header";
import { ListSkeleton } from "@/components/ui/listSkeleton";
import { usePullToRefresh } from "@/components/ui/pullToRefresh.hook";
import { Screen } from "@/components/ui/screen";
import { Text } from "@/components/ui/text";
import { radius, spacing } from "@/constants/spacing.constant";
import { postCommentsService } from "@/services/content/postComments.service";
import { showToast } from "@/store/toast.store";
import { useTheme } from "@/theme";
import type { MyPostComment } from "@/types";
import { formatTimeSincePosted } from "@/utils/formatDate.util";

export const HIDDEN_COMMENTS_QUERY_KEY = ["comments", "me", "hidden"] as const;

const describePost = (comment: MyPostComment) => {
  const text = comment.post.text.trim() || (comment.post.kind === "clip" ? "your clip" : "your post");
  return text.length > 50 ? `${text.slice(0, 47)}…` : text;
};

function HiddenCommentRow({ comment, isUnhiding, onUnhide }: { readonly comment: MyPostComment; readonly isUnhiding: boolean; readonly onUnhide: () => void }) {
  const { colors } = useTheme();
  const authorName = comment.author?.name || `@${comment.author?.username ?? "someone"}`;
  return (
    <View style={[styles.row, { backgroundColor: colors.surface, borderColor: colors.divider }]}>
      <View style={styles.head}>
        <Avatar uri={comment.author?.avatarUrl ?? null} size={32} />
        <View style={styles.headText}>
          <Text size={15} weight={600} lineHeight={19} numberOfLines={1}>{authorName}</Text>
          <Text size={12} lineHeight={16} color={colors.textMuted} numberOfLines={1}>
            {`${comment.parentCommentId ? "Reply on" : "On"} ${describePost(comment)}${comment.hiddenAt ? ` · hidden ${formatTimeSincePosted(comment.hiddenAt)}` : ""}`}
          </Text>
        </View>
        <Button title="Unhide" variant="outline" height={34} loading={isUnhiding} onPress={onUnhide} accessibilityLabel={`Unhide ${authorName}'s comment`} />
      </View>
      <Text size={14} lineHeight={20}>{comment.text}</Text>
    </View>
  );
}

export function HiddenCommentsScreen() {
  const { colors } = useTheme();
  const queryClient = useQueryClient();
  const hidden = useInfiniteQuery({
    queryKey: HIDDEN_COMMENTS_QUERY_KEY,
    queryFn: ({ pageParam }) => postCommentsService.fetchHiddenComments(pageParam),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (page) => page.nextCursor ?? undefined,
  });
  const refreshControl = usePullToRefresh(hidden.refetch);
  const unhide = useMutation({
    mutationFn: (comment: MyPostComment) => postCommentsService.unhideComment(comment.post.id, comment.id),
    onSuccess: (_state, comment) => {
      showToast("Comment is visible again");
      void queryClient.invalidateQueries({ queryKey: ["post-comments", comment.post.id] });
      void queryClient.invalidateQueries({ queryKey: ["post-thread", comment.post.id] });
      return queryClient.invalidateQueries({ queryKey: HIDDEN_COMMENTS_QUERY_KEY });
    },
    onError: () => showToast("Couldn't unhide. Try again."),
  });
  const comments = hidden.data?.pages.flatMap((page) => page.data) ?? [];

  return (
    <Screen background={colors.surface}>
      <Header title="Hidden comments" />
      <FlatList
        data={comments}
        keyExtractor={(comment) => comment.id}
        contentContainerStyle={styles.list}
        refreshControl={refreshControl}
        ItemSeparatorComponent={() => <View style={styles.separator} />}
        onEndReached={() => (hidden.hasNextPage && !hidden.isFetchingNextPage ? void hidden.fetchNextPage() : undefined)}
        ListHeaderComponent={comments.length > 0 ? (
          <Text size={13} lineHeight={18} color={colors.textMuted} style={styles.intro}>
            Only you and each commenter can see these. Replies under a hidden comment are hidden too.
          </Text>
        ) : null}
        renderItem={({ item }) => (
          <HiddenCommentRow comment={item} isUnhiding={unhide.isPending && unhide.variables?.id === item.id} onUnhide={() => !unhide.isPending && unhide.mutate(item)} />
        )}
        ListEmptyComponent={
          hidden.isLoading ? (
            <ListSkeleton />
          ) : hidden.isError ? (
            <ErrorState error={hidden.error} compact message="Couldn't load hidden comments." onRetry={() => hidden.refetch()} retrying={hidden.isRefetching} />
          ) : (
            <EmptyState compact title="No hidden comments" body="When you hide a comment on your post, only you and the person who wrote it can see it." />
          )
        }
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  list: { paddingTop: spacing[6], paddingBottom: spacing[8], paddingHorizontal: spacing[4] },
  separator: { height: 8 },
  intro: { marginBottom: spacing[4] },
  row: { gap: spacing[3], padding: spacing[4], borderRadius: radius.md, borderWidth: StyleSheet.hairlineWidth },
  head: { flexDirection: "row", alignItems: "center", gap: spacing[3] },
  headText: { flex: 1, minWidth: 0 },
});
