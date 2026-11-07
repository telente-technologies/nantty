import { useInfiniteQuery, useQuery } from "@tanstack/react-query";
import { FlatList, Pressable, RefreshControl, StyleSheet, View } from "react-native";

import { Analytics24Icon } from "@/components/icons";
import { Avatar } from "@/components/ui/avatar";
import { BrandLoader } from "@/components/ui/brandLoader";
import { ErrorState } from "@/components/ui/errorState";
import { Header } from "@/components/ui/header";
import { ListSkeleton } from "@/components/ui/listSkeleton";
import { Screen } from "@/components/ui/screen";
import { Text } from "@/components/ui/text";
import { makeThemedStyles, useTheme } from "@/theme";
import type { MainScreenProps } from "@/navigation/navigation.types";
import { postsService } from "@/services/content/posts.service";
import { storiesService } from "@/services/clips/stories.service";
import { useAuthStore } from "@/store/auth.store";
import { formatCountWithThousandsSuffix, formatTimeSincePosted } from "@/utils/formatDate.util";
import type { UserSummary } from "@/types";

export function uniqueStoryViewerRows(pages: readonly { readonly viewers: readonly UserSummary[] }[]): UserSummary[] {
  const seen = new Set<string>();
  return pages.flatMap((page) => page.viewers).filter((viewer) => {
    if (seen.has(viewer.id)) return false;
    seen.add(viewer.id);
    return true;
  });
}

export function StoryAnalyticsScreen({ navigation, route }: MainScreenProps<"StoryAnalytics">) {
  const { colors } = useTheme();
  const styles = useStyles();
  const { storyId } = route.params;
  const isCreator = useAuthStore((s) => s.user?.isCreator ?? false);
  const viewerId = useAuthStore((s) => s.user?.id ?? "guest");
  const analytics = useQuery({ queryKey: ["post-analytics", storyId, viewerId], queryFn: () => postsService.fetchPostAnalytics(storyId) });
  const viewers = useInfiniteQuery({
    queryKey: ["story-viewers", storyId, viewerId],
    queryFn: ({ pageParam }) => storiesService.fetchStoryViewers(storyId, pageParam),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined,
  });
  const viewerList = uniqueStoryViewerRows(viewers.data?.pages ?? []);
  const totalViewers = viewers.data?.pages[0]?.total ?? viewerList.length;
  const data = analytics.data;
  const metrics = [
    { label: "Impressions", value: data?.impressions ?? null },
    { label: "Unique viewers", value: viewers.data?.pages[0]?.total ?? null },
    { label: "Likes", value: data?.likes ?? null },
    { label: "Comments", value: data?.comments ?? null },
    { label: "Shares", value: data?.shares ?? null },
    { label: "Profile visits", value: data?.profileVisits ?? null },
    { label: "New follows", value: data?.newFollows ?? null },
  ];

  return (
    <Screen>
      <Header title="Story analytics" />
      <FlatList
        data={viewerList}
        keyExtractor={(viewer) => viewer.id}
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={analytics.isRefetching || viewers.isRefetching} onRefresh={() => { analytics.refetch(); viewers.refetch(); }} tintColor={colors.primary} colors={[colors.primary]} />}
        ListHeaderComponent={
          <View style={styles.header}>
            <View style={styles.ownerNote}>
              <Analytics24Icon size={18} color={colors.primary} />
              <Text size={12} lineHeight={16.8} color={colors.textMuted} style={styles.ownerNoteText}>
                Only you can see these numbers.
              </Text>
            </View>
            {data ? (
              <View style={styles.grid}>
                {metrics.map((metric) => (
                  <View key={metric.label} style={styles.metric}>
                    <Text size={21} weight={600} lineHeight={25.2}>{metric.value === null ? "—" : formatCountWithThousandsSuffix(metric.value)}</Text>
                    <Text size={12} lineHeight={16.8} color={colors.textMuted}>{metric.label}</Text>
                  </View>
                ))}
              </View>
            ) : analytics.isError ? (
              <View testID="storyAnalyticsLoadError">
                <ErrorState error={analytics.error} onRetry={() => analytics.refetch()} />
              </View>
            ) : <ListSkeleton />}
            {isCreator ? (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Open creator earnings"
                onPress={() => navigation.navigate("CreatorDashboard")}
                style={styles.earnings}
              >
                <View style={styles.earningsText}>
                  <Text size={15} weight={600} lineHeight={20}>How you earn</Text>
                  <Text size={13} lineHeight={17} color={colors.textMuted}>
                    Story ads, coin donations and subscriptions pay into your creator balance.
                  </Text>
                </View>
                <Text size={14} weight={700} lineHeight={18} color={colors.primary}>
                  View earnings
                </Text>
              </Pressable>
            ) : null}
            <View style={styles.viewersHeader}>
              <Text size={16} weight={600} lineHeight={19.2}>
                {viewers.isError ? "Viewers unavailable" : `Viewed by ${viewers.data ? formatCountWithThousandsSuffix(totalViewers) : "—"}`}
              </Text>
              {data ? <Text size={12} lineHeight={16.8} color={colors.textMuted}>Posted {formatTimeSincePosted(data.postedAt)}</Text> : null}
            </View>
          </View>
        }
        renderItem={({ item }) => (
          <View style={styles.viewerRow}>
            <Avatar uri={item.avatarUrl} size={36} />
            <View style={styles.viewerTexts}>
              <Text size={14} weight={600} lineHeight={18} numberOfLines={1}>{item.name}</Text>
              <Text size={12} lineHeight={16} color={colors.textMuted} numberOfLines={1}>@{item.username}</Text>
            </View>
          </View>
        )}
        ListEmptyComponent={
          viewers.isPending ? <BrandLoader size="md" style={styles.viewersLoading} /> : viewers.isError ? (
            <View style={styles.viewersEmptyState}>
              <Text size={13} lineHeight={18} color={colors.textMuted} align="center">
                Could not load story viewers. Your story analytics are still private to you.
              </Text>
              <Pressable accessibilityRole="button" onPress={() => viewers.refetch()} style={styles.retryViewers}>
                <Text size={14} weight={600} lineHeight={18} color={colors.primary}>Retry loading viewers</Text>
              </Pressable>
            </View>
          ) : (
            <Text size={13} lineHeight={18} color={colors.textMuted} align="center" style={styles.viewersEmpty}>
              No views yet. Share your story to get it seen.
            </Text>
          )
        }
        ListFooterComponent={viewers.isFetchingNextPage ? <BrandLoader size="sm" style={styles.viewersLoading} /> : viewers.isFetchNextPageError ? (
          <Pressable accessibilityRole="button" onPress={() => viewers.fetchNextPage()} style={styles.retryViewers}>
            <Text size={14} weight={600} lineHeight={18} color={colors.primary} align="center">Retry loading more viewers</Text>
          </Pressable>
        ) : undefined}
        onEndReached={() => { if (viewers.hasNextPage && !viewers.isFetchingNextPage) viewers.fetchNextPage().catch(() => undefined); }}
        onEndReachedThreshold={0.5}
      />
    </Screen>
  );
}

const useStyles = makeThemedStyles((colors) => StyleSheet.create({
  content: { paddingHorizontal: 16, paddingTop: 8, paddingBottom: 40, gap: 16 },
  header: { gap: 16 },
  ownerNote: { flexDirection: "row", alignItems: "center", gap: 8, paddingHorizontal: 2 },
  ownerNoteText: { flex: 1 },
  grid: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  metric: { width: "48.5%", backgroundColor: colors.surface, borderRadius: 12, padding: 16, gap: 4 },
  earnings: { backgroundColor: colors.surface, borderRadius: 12, padding: 16, gap: 8, flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  earningsText: { flex: 1, gap: 2 },
  viewersHeader: { gap: 2, paddingTop: 4 },
  viewerRow: { flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 8 },
  viewerTexts: { flex: 1, gap: 1 },
  viewersLoading: { paddingVertical: 24 },
  viewersEmpty: { paddingVertical: 24 },
  viewersEmptyState: { alignItems: "center", gap: 8, paddingVertical: 24 },
  retryViewers: { alignSelf: "center", paddingHorizontal: 12, paddingVertical: 8 },
}));
