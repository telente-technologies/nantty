import { FlatList, StyleSheet, View } from "react-native";

import { Header } from "@/components/ui/header";
import { Screen } from "@/components/ui/screen";
import { Text } from "@/components/ui/text";
import { TransactionRow } from "@/components/wallet/transactionRow";
import { useWalletTransactionsQuery } from "@/components/wallet/walletQueries.hook";
import { colors } from "@/constants/colors.constant";

export function TransactionsScreen() {
  const { data: transactions = [], isLoading, refetch, isRefetching } = useWalletTransactionsQuery();
  return (
    <Screen>
      <Header title="Transactions" />
      <FlatList
        data={transactions}
        keyExtractor={(t) => t.id}
        refreshing={isRefetching}
        onRefresh={refetch}
        contentContainerStyle={styles.list}
        ItemSeparatorComponent={() => <View style={styles.separator} />}
        renderItem={({ item }) => <TransactionRow transaction={item} />}
        ListEmptyComponent={
          isLoading ? null : (
            <Text size={14} lineHeight={16.8} color={colors.textSubtle} align="center" style={styles.empty}>
              No transactions yet
            </Text>
          )
        }
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  list: { marginHorizontal: 16, marginTop: 24, borderRadius: 12, overflow: "hidden", paddingBottom: 40 },
  separator: { height: 1, backgroundColor: colors.background },
  empty: { marginTop: 60 },
});
