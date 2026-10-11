import { useQuery } from "@tanstack/react-query";
import { FlatList, RefreshControl, StyleSheet, View } from "react-native";

import { formatFriendlyDate } from "@/components/escrow/escrowStage.util";
import { StatusPill } from "@/components/escrow/statusPill";
import { REPORT_STATUS_APPEARANCE } from "@/components/settings/supportAppearance.util";
import { Header } from "@/components/ui/header";
import { Screen } from "@/components/ui/screen";
import { Text } from "@/components/ui/text";
import { makeThemedStyles, useTheme } from "@/theme";
import { supportService } from "@/services/support/support.service";
import { ErrorState } from "@/components/ui/errorState";
import { ListSkeleton } from "@/components/ui/listSkeleton";

export function MyReportsScreen() {
  const { colors } = useTheme();
  const styles = useStyles();
  const reports = useQuery({ queryKey: ["reports", "mine"], queryFn: supportService.listMyContentReports });
  return (
    <Screen>
      <Header title="My reports" />
      <FlatList
        data={reports.data ?? []}
        keyExtractor={(report) => report.id}
        contentContainerStyle={styles.list}
        refreshControl={<RefreshControl refreshing={reports.isRefetching} onRefresh={() => reports.refetch()} tintColor={colors.primary} colors={[colors.primary]} />}
        ItemSeparatorComponent={() => <View style={styles.separator} />}
        renderItem={({ item }) => (
          <View style={styles.row}>
            <View style={styles.top}>
              <Text size={14} weight={500} lineHeight={16.8} numberOfLines={1} style={styles.flex}>{item.targetLabel}</Text>
              <StatusPill label={REPORT_STATUS_APPEARANCE[item.status].label} tone={REPORT_STATUS_APPEARANCE[item.status].tone} />
            </View>
            <Text size={13} lineHeight={16.9} color={colors.textMuted}>{item.reason} · reported {formatFriendlyDate(item.createdAt)}</Text>
            {item.outcomeNote ? <Text size={13} lineHeight={17.5}>{item.outcomeNote}</Text> : null}
          </View>
        )}
        ListEmptyComponent={reports.isLoading ? <ListSkeleton rows={3} /> : reports.isError ? <ErrorState message="Couldn't load your reports." onRetry={() => reports.refetch()} /> : <Text align="center" color={colors.textSubtle}>You haven't reported anything.</Text>}
      />
    </Screen>
  );
}

const useStyles = makeThemedStyles((colors) => StyleSheet.create({
  flex: { flex: 1 },
  list: { paddingHorizontal: 16, paddingTop: 16, paddingBottom: 40 },
  separator: { height: 8 },
  row: { backgroundColor: colors.surface, borderRadius: 12, padding: 14, gap: 6 },
  top: { flexDirection: "row", alignItems: "center", gap: 8 },
}));
