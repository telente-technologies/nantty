import { Image } from "expo-image";
import { FlatList, StyleSheet, View } from "react-native";

import { Header } from "@/components/ui/header";
import { Screen } from "@/components/ui/screen";
import { Text } from "@/components/ui/text";
import { useStoreCreditBalancesQuery } from "@/components/wallet/walletQueries.hook";
import { makeThemedStyles, useTheme } from "@/theme";
import { formatMoneyForDisplay } from "@/utils/formatMoney.util";

export function StoreRewardsScreen() {
  const { colors } = useTheme();
  const styles = useStyles();
  const { data: balances = [], isLoading, refetch, isRefetching } = useStoreCreditBalancesQuery();
  return (
    <Screen>
      <Header title="Store rewards" />
      <Text size={12} lineHeight={16.8} color={colors.textMuted} style={styles.note}>
        Store credit is funded by each seller. It can only be used at that store, as a discount on a future order. It is not cash and cannot be withdrawn.
      </Text>
      <FlatList
        data={balances}
        keyExtractor={(entry) => entry.storeId}
        refreshing={isRefetching}
        onRefresh={refetch}
        contentContainerStyle={styles.list}
        ItemSeparatorComponent={() => <View style={styles.separator} />}
        renderItem={({ item }) => (
          <View style={styles.row}>
            <View style={styles.logo}>{item.logoUrl ? <Image source={{ uri: item.logoUrl }} style={StyleSheet.absoluteFill} contentFit="cover" /> : null}</View>
            <View style={styles.text}>
              <Text size={14} weight={500} lineHeight={16.8}>{item.storeName}</Text>
              {item.expiresAt ? <Text size={12} lineHeight={16.8} color={colors.textMuted}>Expires {new Date(item.expiresAt).toLocaleDateString()}</Text> : null}
            </View>
            <Text size={14} weight={600} lineHeight={16.8}>{formatMoneyForDisplay(item.balance)}</Text>
          </View>
        )}
        ListEmptyComponent={isLoading ? null : <Text size={14} lineHeight={16.8} color={colors.textSubtle} align="center" style={styles.empty}>No store credit yet</Text>}
      />
    </Screen>
  );
}

const useStyles = makeThemedStyles((colors) => StyleSheet.create({
  note: { marginHorizontal: 16, marginTop: 16 },
  list: { marginHorizontal: 16, marginTop: 16, borderRadius: 12, overflow: "hidden", paddingBottom: 40 },
  separator: { height: 1, backgroundColor: colors.background },
  row: { flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 12 },
  logo: { width: 40, height: 40, borderRadius: 20, overflow: "hidden", backgroundColor: colors.divider },
  text: { flex: 1, gap: 2 },
  empty: { marginTop: 60 },
}));
