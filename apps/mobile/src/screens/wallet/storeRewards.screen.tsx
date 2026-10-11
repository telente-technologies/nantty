import { Image } from "expo-image";
import { FlatList, StyleSheet, View } from "react-native";

import { Gift24Icon } from "@/components/icons";
import { EmptyState } from "@/components/ui/emptyState";
import { ErrorState } from "@/components/ui/errorState";
import { Header } from "@/components/ui/header";
import { ListSkeleton } from "@/components/ui/listSkeleton";
import { usePullToRefresh } from "@/components/ui/pullToRefresh.hook";
import { Screen } from "@/components/ui/screen";
import { Text } from "@/components/ui/text";
import { useStoreCreditBalancesQuery } from "@/components/wallet/walletQueries.hook";
import { makeThemedStyles, useTheme } from "@/theme";
import { formatMoneyForDisplay } from "@/utils/formatMoney.util";
import { spacing } from "@/constants/spacing.constant";
import { typeScale } from "@/constants/typography.constant";

export function StoreRewardsScreen() {
  const { colors } = useTheme();
  const styles = useStyles();
  const { data: balances = [], isLoading, isError, error, refetch, isRefetching } = useStoreCreditBalancesQuery();
  const refreshControl = usePullToRefresh(refetch);
  return (
    <Screen>
      <Header title="Store rewards" />
      <Text size={typeScale.xs} lineHeight={16.8} color={colors.textMuted} style={styles.note}>
        Store credit is funded by each seller. It can only be used at that store, as a discount on a future order. It is not cash and cannot be withdrawn.
      </Text>
      <FlatList
        data={balances}
        keyExtractor={(entry) => entry.storeId}
        refreshControl={refreshControl}
        contentContainerStyle={styles.list}
        ItemSeparatorComponent={() => <View style={styles.separator} />}
        renderItem={({ item }) => (
          <View style={styles.row}>
            <View style={styles.logo}>{item.logoUrl ? <Image source={{ uri: item.logoUrl }} style={StyleSheet.absoluteFill} contentFit="cover" /> : null}</View>
            <View style={styles.text}>
              <Text size={typeScale.md} weight={500} lineHeight={16.8}>{item.storeName}</Text>
              {item.expiresAt ? <Text size={typeScale.xs} lineHeight={16.8} color={colors.textMuted}>Expires {new Date(item.expiresAt).toLocaleDateString()}</Text> : null}
            </View>
            <Text size={typeScale.md} weight={600} lineHeight={16.8}>{formatMoneyForDisplay(item.balance)}</Text>
          </View>
        )}
        ListEmptyComponent={
          isLoading ? (
            <ListSkeleton rows={4} avatarSize={40} padding={0} />
          ) : isError ? (
            <ErrorState error={error} compact message="Couldn't load store rewards." onRetry={() => refetch()} retrying={isRefetching} />
          ) : (
            <EmptyState compact icon={<Gift24Icon color={colors.textMuted} />} title="No store credit yet" body="Credit a seller gives you will appear here." />
          )
        }
      />
    </Screen>
  );
}

const useStyles = makeThemedStyles((colors) => StyleSheet.create({
  note: { marginHorizontal: spacing[4], marginTop: spacing[4] },
  list: { marginHorizontal: spacing[4], marginTop: spacing[4], borderRadius: 12, overflow: "hidden", paddingBottom: spacing[8] },
  separator: { height: 1, backgroundColor: colors.background },
  row: { flexDirection: "row", alignItems: "center", gap: spacing[3], paddingVertical: spacing[3] },
  logo: { width: 40, height: 40, borderRadius: 20, overflow: "hidden", backgroundColor: colors.divider },
  text: { flex: 1, gap: 2 },
}));
