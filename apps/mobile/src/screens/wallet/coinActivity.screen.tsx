import { useInfiniteQuery } from "@tanstack/react-query";
import { FlatList, StyleSheet, View } from "react-native";

import { formatFriendlyDateTime } from "@/components/escrow/escrowStage.util";
import { Button } from "@/components/ui/button";
import { Header } from "@/components/ui/header";
import { Screen } from "@/components/ui/screen";
import { Text } from "@/components/ui/text";
import { colors } from "@/constants/colors.constant";
import { coinsService } from "@/services/coins.service";
import type { CoinActivityEntry } from "@/types";

export function CoinActivityScreen() {
  const activity = useInfiniteQuery({
    queryKey: ["coin-activity"],
    queryFn: ({ pageParam }) => coinsService.listCoinActivity(pageParam),
    initialPageParam: null as string | null,
    getNextPageParam: (lastPage) => lastPage.nextCursor,
  });
  const entries: CoinActivityEntry[] = activity.data?.pages.flatMap((page) => page.data) ?? [];
  return (
    <Screen>
      <Header title="Coin activity" />
      <FlatList
        data={entries}
        keyExtractor={(entry) => entry.id}
        refreshing={activity.isRefetching}
        onRefresh={() => activity.refetch()}
        contentContainerStyle={styles.list}
        ItemSeparatorComponent={() => <View style={styles.separator} />}
        renderItem={({ item }) => (
          <View style={styles.row}>
            <View style={styles.flex}>
              <Text size={14} weight={500} lineHeight={16.8} color={item.type === "credit" ? colors.success : colors.error}>
                {item.type === "credit" ? "+" : "−"}{item.coins.toLocaleString("en-US")} coins
              </Text>
              <Text size={12} lineHeight={16.8} color={colors.textSubtle}>Balance {item.balanceAfter.toLocaleString("en-US")} coins</Text>
            </View>
            <Text size={12} lineHeight={16.8} color={colors.textSubtle}>{formatFriendlyDateTime(item.createdAt)}</Text>
          </View>
        )}
        ListEmptyComponent={
          activity.isPending ? null : (
            <Text size={14} lineHeight={16.8} color={colors.textSubtle} align="center" style={styles.empty}>
              No coin activity yet
            </Text>
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

const styles = StyleSheet.create({
  list: { marginHorizontal: 16, marginTop: 24, borderRadius: 12, overflow: "hidden", paddingBottom: 40 },
  separator: { height: 1, backgroundColor: colors.background },
  empty: { marginTop: 60 },
  row: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12, backgroundColor: colors.white, paddingHorizontal: 16, paddingVertical: 14 },
  flex: { flex: 1 },
  loadMore: { marginTop: 12, marginHorizontal: 16 },
});
