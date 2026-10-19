import { useInfiniteQuery, useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { ActivityIndicator, FlatList, Pressable, ScrollView, StyleSheet, View } from "react-native";

import { AdsHubBoostRow } from "@/components/ads/adsHubBoostRow";
import { AdsManagerBanner } from "@/components/boost/adsManagerBanner";
import { CaretRight16Icon, Plus24Icon, Wallet24Icon } from "@/components/icons";
import { Button } from "@/components/ui/button";
import { Chip } from "@/components/ui/chip";
import { EmptyState } from "@/components/ui/emptyState";
import { ErrorState } from "@/components/ui/errorState";
import { Header, HeaderAction } from "@/components/ui/header";
import { ListSkeleton } from "@/components/ui/listSkeleton";
import { usePullToRefresh } from "@/components/ui/pullToRefresh.hook";
import { Screen } from "@/components/ui/screen";
import { Text } from "@/components/ui/text";
import type { MainScreenProps } from "@/navigation/navigation.types";
import { adsHubService } from "@/services/ads/adsHub.service";
import { makeThemedStyles, useTheme } from "@/theme";
import { AD_STATUS_FILTERS, type AdStatusFilter } from "@/utils/adsHub.util";
import { formatMoneyForDisplay } from "@/utils/formatMoney.util";

export const adsHubQueryKeys = {
  boosts: (filter: AdStatusFilter["key"]) => ["ads", "boosts", filter] as const,
  balance: ["ads", "balance"] as const,
};

export function AdsHubScreen({ navigation }: MainScreenProps<"AdsHub">) {
  const { colors } = useTheme();
  const styles = useStyles();
  const [filterKey, setFilterKey] = useState<AdStatusFilter["key"]>("all");
  const filter = AD_STATUS_FILTERS.find((candidate) => candidate.key === filterKey) ?? AD_STATUS_FILTERS[0]!;
  const boosts = useInfiniteQuery({
    queryKey: adsHubQueryKeys.boosts(filter.key),
    queryFn: ({ pageParam }) => adsHubService.listMyBoosts(filter.statuses, pageParam),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined,
  });
  const balance = useQuery({ queryKey: adsHubQueryKeys.balance, queryFn: adsHubService.fetchAdBalance });
  const refreshControl = usePullToRefresh(boosts.refetch, balance.refetch);
  const items = boosts.data?.pages.flatMap((page) => page.data) ?? [];
  const createAd = () => navigation.navigate("CreateAd", undefined);

  const listHeader = (
    <View style={styles.header}>
      <Pressable accessibilityRole="button" accessibilityLabel={balance.data ? `Ad credit and balance, ${formatMoneyForDisplay(balance.data.spendable)} to spend on ads` : "Ad balance"} onPress={() => navigation.navigate("AdBalance")} style={styles.balanceRow}>
        <Wallet24Icon size={20} color={colors.text} />
        <View style={styles.flex}>
          <Text size={14} weight={600} lineHeight={16.8}>Ad credit & balance</Text>
          <Text size={12} lineHeight={16} color={colors.textMuted}>
            {balance.data ? `${formatMoneyForDisplay(balance.data.spendable)} to spend · ${formatMoneyForDisplay(balance.data.credit)} credit, ${formatMoneyForDisplay(balance.data.balance)} balance` : balance.isError ? "Couldn't load your ad balance" : "Loading…"}
          </Text>
        </View>
        <CaretRight16Icon size={16} color={colors.textMuted} />
      </Pressable>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filters} accessibilityRole="tablist">
        {AD_STATUS_FILTERS.map((option) => (
          <Chip key={option.key} kind="topic" label={option.label} selected={option.key === filter.key} onPress={() => setFilterKey(option.key)} />
        ))}
      </ScrollView>
    </View>
  );

  return (
    <Screen>
      <Header
        title="Ads"
        right={<HeaderAction label="Create ad" onPress={createAd}><Plus24Icon size={22} color={colors.text} /></HeaderAction>}
      />
      <FlatList
        data={items}
        keyExtractor={(boost) => boost.id}
        refreshControl={refreshControl}
        contentContainerStyle={styles.content}
        ListHeaderComponent={listHeader}
        renderItem={({ item }) => <AdsHubBoostRow boost={item} onPress={() => navigation.navigate("BoostStatus", { boostId: item.id })} />}
        ItemSeparatorComponent={() => <View style={styles.separator} />}
        onEndReached={() => { if (boosts.hasNextPage && !boosts.isFetchingNextPage) boosts.fetchNextPage().catch(() => undefined); }}
        onEndReachedThreshold={0.5}
        ListEmptyComponent={
          boosts.isPending ? <ListSkeleton /> : boosts.isError ? (
            <ErrorState error={boosts.error} message="Couldn't load your ads." onRetry={() => boosts.refetch()} retrying={boosts.isRefetching} variant="section" />
          ) : (
            <EmptyState
              compact
              title={filter.key === "all" ? "No ads yet" : `No ${filter.label.toLowerCase()} ads`}
              body={filter.key === "all" ? "Promote a post, product, your store or your profile. You can do everything here in the app." : "Try another filter."}
              actionLabel={filter.key === "all" ? "Create ad" : undefined}
              onAction={filter.key === "all" ? createAd : undefined}
            />
          )
        }
        ListFooterComponent={
          <View style={styles.footer}>
            {boosts.isFetchingNextPage ? <ActivityIndicator color={colors.primary} /> : null}
            {boosts.isError && items.length > 0 ? <ErrorState error={boosts.error} variant="inline" onRetry={() => boosts.fetchNextPage()} /> : null}
            {items.length > 0 ? <Button title="Create ad" onPress={createAd} /> : null}
            <AdsManagerBanner />
          </View>
        }
      />
    </Screen>
  );
}

const useStyles = makeThemedStyles((colors) => StyleSheet.create({
  content: { paddingHorizontal: 16, paddingBottom: 32 },
  header: { gap: 12, paddingTop: 8, paddingBottom: 12 },
  balanceRow: { flexDirection: "row", alignItems: "center", gap: 12, backgroundColor: colors.surface, borderRadius: 12, padding: 14, minHeight: 44 },
  flex: { flex: 1, gap: 2 },
  filters: { gap: 8 },
  separator: { height: 8 },
  footer: { gap: 12, paddingTop: 16 },
}));
