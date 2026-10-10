import { useQuery } from "@tanstack/react-query";
import { RefreshControl, ScrollView, StyleSheet, View } from "react-native";

import { Analytics24Icon } from "@/components/icons";
import { Header } from "@/components/ui/header";
import { Screen } from "@/components/ui/screen";
import { Text } from "@/components/ui/text";
import { makeThemedStyles, useTheme } from "@/theme";
import type { MainScreenProps } from "@/navigation/navigation.types";
import { postsService } from "@/services/content/posts.service";
import { formatCountWithThousandsSuffix, formatTimeSincePosted } from "@/utils/formatDate.util";
import { ListSkeleton } from "@/components/ui/listSkeleton";
import { ErrorState } from "@/components/ui/errorState";

const DAY_LABELS: readonly string[] = ["S", "M", "T", "W", "T", "F", "S"];

export function PostAnalyticsScreen({ route }: MainScreenProps<"PostAnalytics">) {
  const { colors } = useTheme();
  const styles = useStyles();
  const analytics = useQuery({
    queryKey: ["post-analytics", route.params.postId],
    queryFn: () => postsService.fetchPostAnalytics(route.params.postId),
  });

  if (!analytics.data) {
    return (
      <Screen>
        <Header title="Post analytics" />
        {analytics.isError ? (
          <ErrorState message={analytics.error.message} onRetry={() => analytics.refetch()} />
        ) : (
          <ListSkeleton />
        )}
      </Screen>
    );
  }

  const data = analytics.data;
  const peak = Math.max(1, ...data.daily.map((entry) => entry.impressions));
  const metrics = [
    { label: "Impressions", value: data.impressions },
    { label: "Unique viewers", value: data.uniqueViewers },
    { label: "Profile visits", value: data.profileVisits },
    { label: "Engagements", value: data.engagements },
    { label: "Engagement rate", value: `${data.engagementRate}%` },
    { label: "New follows", value: data.newFollows },
    ...(data.video
      ? [
          { label: "Video views", value: data.video.views },
          { label: "Watch time", value: `${Math.round(data.video.watchTimeSeconds / 60)} min` },
        ]
      : []),
  ];
  const engagementRows = [
    { label: "Likes", value: data.likes },
    { label: "Replies", value: data.comments },
    { label: "Reposts", value: data.reposts },
    { label: "Saves", value: data.saves },
    { label: "Shares", value: data.shares },
    { label: "Link clicks", value: data.linkClicks },
    { label: "Profile clicks", value: data.profileClicks },
  ];

  return (
    <Screen>
      <Header title="Post analytics" />
      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={analytics.isRefetching} onRefresh={() => analytics.refetch()} tintColor={colors.primary} />}
      >
        <View style={styles.ownerNote}>
          <Analytics24Icon size={18} color={colors.primary} />
          <Text size={12} lineHeight={16.8} color={colors.textMuted} style={styles.ownerNoteText}>
            Only you can see these numbers.
          </Text>
        </View>

        <View style={styles.grid}>
          {metrics.map((metric) => (
            <View key={metric.label} style={styles.metric}>
              <Text size={21} weight={600} lineHeight={25.2}>{typeof metric.value === "number" ? formatCountWithThousandsSuffix(metric.value) : metric.value}</Text>
              <Text size={12} lineHeight={16.8} color={colors.textMuted}>{metric.label}</Text>
            </View>
          ))}
        </View>

        <View style={styles.card}>
          <Text size={16} weight={600} lineHeight={19.2}>Impressions, last 7 days</Text>
          <View style={styles.chart} accessibilityLabel="Daily impressions for the last seven days">
            {data.daily.map((entry, index) => (
              <View key={entry.day} style={styles.chartColumn}>
                <View style={styles.chartTrack}>
                  <View style={[styles.chartBar, { height: `${Math.max(4, Math.round((entry.impressions / peak) * 100))}%` }]} />
                </View>
                <Text size={11} lineHeight={14} color={colors.textSubtle}>{DAY_LABELS[index % DAY_LABELS.length]}</Text>
              </View>
            ))}
          </View>
        </View>

        <View style={styles.card}>
          <Text size={16} weight={600} lineHeight={19.2}>Engagements</Text>
          {engagementRows.map((row) => (
            <View key={row.label} style={styles.rowBetween} accessible accessibilityLabel={`${row.label}, ${row.value}`}>
              <Text size={14} color={colors.textMuted}>{row.label}</Text>
              <Text size={14} weight={600}>{formatCountWithThousandsSuffix(row.value)}</Text>
            </View>
          ))}
        </View>

        {data.audience.length > 0 ? (
          <View style={styles.card}>
            <Text size={16} weight={600} lineHeight={19.2}>Audience</Text>
            {data.audience.map((row) => (
              <View key={row.label} style={styles.rowBetween} accessible accessibilityLabel={`${row.label}, ${row.share} percent`}>
                <Text size={14} color={colors.textMuted}>{row.label}</Text>
                <Text size={14} weight={600}>{row.share}%</Text>
              </View>
            ))}
          </View>
        ) : null}

        <View style={styles.card}>
          <Text size={16} weight={600} lineHeight={19.2}>This post</Text>
          <View style={styles.postRow}>
            <Text size={14} lineHeight={18} numberOfLines={3} style={styles.postText}>{data.author.name}</Text>
            <Text size={12} lineHeight={16.8} color={colors.textSubtle}>Posted {formatTimeSincePosted(data.postedAt)}</Text>
          </View>
          <View style={styles.footRow}>
            <Text size={13} color={colors.textMuted}>Likes · {formatCountWithThousandsSuffix(data.likes)}</Text>
            <Text size={13} color={colors.textMuted}>Comments · {formatCountWithThousandsSuffix(data.comments)}</Text>
          </View>
        </View>
      </ScrollView>
    </Screen>
  );
}

const useStyles = makeThemedStyles((colors) => StyleSheet.create({
  content: { paddingHorizontal: 16, paddingTop: 8, paddingBottom: 40, gap: 16 },
  ownerNote: { flexDirection: "row", alignItems: "center", gap: 8, paddingHorizontal: 2 },
  ownerNoteText: { flex: 1 },
  grid: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  metric: { width: "48.5%", backgroundColor: colors.surface, borderRadius: 12, padding: 16, gap: 4 },
  card: { backgroundColor: colors.surface, borderRadius: 12, padding: 16, gap: 14 },
  chart: { flexDirection: "row", alignItems: "flex-end", gap: 8, height: 160 },
  chartColumn: { flex: 1, alignItems: "center", gap: 6 },
  chartTrack: { width: "100%", flex: 1, justifyContent: "flex-end", backgroundColor: colors.skeleton, borderRadius: 6, overflow: "hidden" },
  chartBar: { width: "100%", backgroundColor: colors.primarySolid, borderRadius: 6 },
  rowBetween: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  postRow: { gap: 4 },
  postText: { flexShrink: 1 },
  footRow: { flexDirection: "row", gap: 16 },
}));
