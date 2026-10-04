import { useQuery } from "@tanstack/react-query";
import { FlatList, Pressable, RefreshControl, StyleSheet, View } from "react-native";

import { formatFriendlyDate } from "@/components/escrow/escrowStage.util";
import { StatusPill } from "@/components/escrow/statusPill";
import { TICKET_STATUS_APPEARANCE } from "@/components/settings/supportAppearance.util";
import { Button } from "@/components/ui/button";
import { Header } from "@/components/ui/header";
import { Screen } from "@/components/ui/screen";
import { Text } from "@/components/ui/text";
import { makeThemedStyles, useTheme } from "@/theme";
import type { MainScreenProps } from "@/navigation/navigation.types";
import { supportService } from "@/services/support.service";
import { ErrorState } from "@/components/ui/errorState";
import { ListSkeleton } from "@/components/ui/listSkeleton";

export const supportTicketsQueryKey = ["support", "tickets"] as const;

export function SupportTicketsScreen({ navigation }: MainScreenProps<"SupportTickets">) {
  const { colors } = useTheme();
  const styles = useStyles();
  const tickets = useQuery({ queryKey: supportTicketsQueryKey, queryFn: supportService.listMySupportTickets });
  return (
    <Screen>
      <Header title="Support requests" />
      <FlatList
        data={tickets.data ?? []}
        keyExtractor={(ticket) => ticket.id}
        contentContainerStyle={styles.list}
        refreshControl={<RefreshControl refreshing={tickets.isRefetching} onRefresh={() => tickets.refetch()} tintColor={colors.primary} />}
        ListHeaderComponent={<Button title="Contact support" onPress={() => navigation.navigate("NewSupportTicket")} style={styles.header} />}
        ItemSeparatorComponent={() => <View style={styles.separator} />}
        renderItem={({ item }) => (
          <Pressable accessibilityRole="button" accessibilityLabel={item.subject} onPress={() => navigation.navigate("SupportTicketDetail", { ticketId: item.id })} style={styles.row}>
            <View style={styles.rowTop}>
              <Text size={14} weight={(item.unreadCount ?? 0) > 0 ? 600 : 500} lineHeight={16.8} numberOfLines={1} style={styles.flex}>{item.subject}</Text>
              {(item.unreadCount ?? 0) > 0 ? <View style={styles.badge} accessibilityLabel={`${item.unreadCount} unread replies`}><Text size={11} weight={600} color={colors.white}>{item.unreadCount}</Text></View> : null}
              <StatusPill label={TICKET_STATUS_APPEARANCE[item.status].label} tone={TICKET_STATUS_APPEARANCE[item.status].tone} />
            </View>
            <Text size={13} lineHeight={16.9} color={colors.textMuted} numberOfLines={1}>{item.lastMessagePreview}</Text>
            {item.linkedReference ? <Text size={12} lineHeight={16.8} color={colors.textMuted}>{item.linkedReference.label}</Text> : null}
            <Text size={12} lineHeight={16.8} color={colors.textSubtle}>{item.reference ? `${item.reference} · ` : ""}Updated {formatFriendlyDate(item.updatedAt)}</Text>
          </Pressable>
        )}
        ListEmptyComponent={tickets.isLoading ? <ListSkeleton rows={3} /> : tickets.isError ? <ErrorState message="Couldn't load your requests." onRetry={() => tickets.refetch()} /> : <Text align="center" color={colors.textSubtle}>No support requests yet.</Text>}
      />
    </Screen>
  );
}

const useStyles = makeThemedStyles((colors) => StyleSheet.create({
  flex: { flex: 1 },
  list: { paddingHorizontal: 16, paddingBottom: 40 },
  header: { marginVertical: 16 },
  separator: { height: 8 },
  row: { backgroundColor: colors.surface, borderRadius: 12, padding: 14, gap: 4 },
  rowTop: { flexDirection: "row", alignItems: "center", gap: 8 },
  badge: { minWidth: 20, height: 20, borderRadius: 10, paddingHorizontal: 6, alignItems: "center", justifyContent: "center", backgroundColor: colors.error },
}));
