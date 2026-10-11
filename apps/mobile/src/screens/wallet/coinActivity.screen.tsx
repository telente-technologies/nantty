import { useInfiniteQuery } from "@tanstack/react-query";
import { FlatList, StyleSheet, View } from "react-native";

import { formatFriendlyDateTime } from "@/components/escrow/escrowStage.util";
import { Button } from "@/components/ui/button";
import { Coin24Icon } from "@/components/icons";
import { EmptyState } from "@/components/ui/emptyState";
import { ErrorState } from "@/components/ui/errorState";
import { Header } from "@/components/ui/header";
import { ListSkeleton } from "@/components/ui/listSkeleton";
import { usePullToRefresh } from "@/components/ui/pullToRefresh.hook";
import { Screen } from "@/components/ui/screen";
import { Text } from "@/components/ui/text";
import { makeThemedStyles, useTheme } from "@/theme";
import { coinsService } from "@/services/money/coins.service";
import type { CoinActivityEntry } from "@/types";
import { spacing } from "@/constants/spacing.constant";
import { typeScale } from "@/constants/typography.constant";

export function CoinActivityScreen() {
  const { colors } = useTheme();
  const styles = useStyles();
  const activity = useInfiniteQuery({
    queryKey: ["coin-activity"],
    queryFn: ({ pageParam }) => coinsService.listCoinActivity(pageParam),
    initialPageParam: null as string | null,
    getNextPageParam: (lastPage) => lastPage.nextCursor,
  });
  const entries: CoinActivityEntry[] = activity.data?.pages.flatMap((page) => page.data) ?? [];
  const refreshControl = usePullToRefresh(activity.refetch);
  return (
    <Screen>
      <Header title="Coin activity" />
      <FlatList
        data={entries}
        keyExtractor={(entry) => entry.id}
        refreshControl={refreshControl}
        contentContainerStyle={styles.list}
        ItemSeparatorComponent={() => <View style={styles.separator} />}
        renderItem={({ item }) => (
          <View style={styles.row}>
            <View style={styles.flex}>
              <Text size={typeScale.md} weight={500} lineHeight={16.8} color={item.type === "credit" ? colors.success : colors.error}>
                {item.type === "credit" ? "+" : "−"}{item.coins.toLocaleString("en-US")} coins
              </Text>
              <Text size={typeScale.xs} lineHeight={16.8} color={colors.textSubtle}>Balance {item.balanceAfter.toLocaleString("en-US")} coins</Text>
            </View>
            <Text size={typeScale.xs} lineHeight={16.8} color={colors.textSubtle}>{formatFriendlyDateTime(item.createdAt)}</Text>
          </View>
        )}
        ListEmptyComponent={
          activity.isPending ? (
            <ListSkeleton rows={8} avatarSize={0} padding={12} />
          ) : activity.isError ? (
            <ErrorState error={activity.error} compact message="Couldn't load coin activity." onRetry={() => activity.refetch()} retrying={activity.isRefetching} />
          ) : (
            <EmptyState compact icon={<Coin24Icon color={colors.textMuted} />} title="No coin activity yet" body="Coins you buy, send and receive will show up here." />
          )
        }
        ListFooterComponent={
          activity.hasNextPage ? (
            <Button variant="subtle" title="Load more" loading={activity.isFetchingNextPage} onPress={() => activity.fetchNextPage()} style={styles.loadMore} />
          ) : null
        }
      />
    </Screen>
  );
}

const useStyles = makeThemedStyles((colors) => StyleSheet.create({
  list: { marginHorizontal: spacing[4], marginTop: spacing[6], borderRadius: 12, overflow: "hidden", paddingBottom: spacing[8] },
  separator: { height: 1, backgroundColor: colors.background },
  row: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: spacing[3], backgroundColor: colors.surface, paddingHorizontal: spacing[4], paddingVertical: 14 },
  flex: { flex: 1 },
  loadMore: { marginTop: spacing[3], marginHorizontal: spacing[4] },
}));
