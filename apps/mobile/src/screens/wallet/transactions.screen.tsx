import { FlatList, StyleSheet, View } from "react-native";

import { CreditCard24Icon } from "@/components/icons";
import { EmptyState } from "@/components/ui/emptyState";
import { ErrorState } from "@/components/ui/errorState";
import { Header } from "@/components/ui/header";
import { ListSkeleton } from "@/components/ui/listSkeleton";
import { usePullToRefresh } from "@/components/ui/pullToRefresh.hook";
import { Screen } from "@/components/ui/screen";
import { TransactionRow } from "@/components/wallet/transactionRow";
import { useWalletTransactionsQuery } from "@/components/wallet/walletQueries.hook";
import { makeThemedStyles, useTheme } from "@/theme";
import { spacing } from "@/constants/spacing.constant";

export function TransactionsScreen() {
  const { colors } = useTheme();
  const styles = useStyles();
  const { data: transactions = [], isLoading, isError, refetch, isRefetching } = useWalletTransactionsQuery();
  const refreshControl = usePullToRefresh(refetch);
  return (
    <Screen>
      <Header title="Transactions" />
      <FlatList
        data={transactions}
        keyExtractor={(t) => t.id}
        refreshControl={refreshControl}
        contentContainerStyle={styles.list}
        ItemSeparatorComponent={() => <View style={styles.separator} />}
        renderItem={({ item }) => <TransactionRow transaction={item} />}
        ListEmptyComponent={
          isLoading ? (
            <ListSkeleton rows={8} avatarSize={40} padding={0} />
          ) : isError ? (
            <ErrorState compact message="Couldn't load transactions." onRetry={() => refetch()} retrying={isRefetching} />
          ) : (
            <EmptyState compact icon={<CreditCard24Icon color={colors.textMuted} />} title="No transactions yet" body="Payments, refunds and payouts will show up here." />
          )
        }
      />
    </Screen>
  );
}

const useStyles = makeThemedStyles((colors) => StyleSheet.create({
  list: { marginHorizontal: spacing[4], marginTop: spacing[6], borderRadius: 12, overflow: "hidden", paddingBottom: spacing[8] },
  separator: { height: 1, backgroundColor: colors.background },
}));
