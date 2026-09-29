import { useQuery } from "@tanstack/react-query";
import { ActivityIndicator, RefreshControl, ScrollView, StyleSheet, View } from "react-native";

import { formatFriendlyDate } from "@/components/escrow/escrowStage.util";
import { StatusPill, type StatusTone } from "@/components/escrow/statusPill";
import { Button } from "@/components/ui/button";
import { Header } from "@/components/ui/header";
import { Screen } from "@/components/ui/screen";
import { Text } from "@/components/ui/text";
import { colors } from "@/constants/colors.constant";
import type { MainScreenProps } from "@/navigation/navigation.types";
import { boostsService } from "@/services/boosts.service";
import type { Boost } from "@/types/boost.type";
import { formatCountWithThousandsSuffix } from "@/utils/formatDate.util";
import { formatMoneyForDisplay } from "@/utils/formatMoney.util";

const STATUS_APPEARANCE: Record<Boost["status"], { label: string; tone: StatusTone }> = {
  pending_payment: { label: "Waiting for payment", tone: "neutral" },
  in_review: { label: "In review", tone: "caution" },
  active: { label: "Running", tone: "primary" },
  completed: { label: "Completed", tone: "success" },
  rejected: { label: "Not approved", tone: "error" },
};

export function BoostStatusScreen({ navigation, route }: MainScreenProps<"BoostStatus">) {
  const boost = useQuery({ queryKey: ["boosts", route.params.boostId], queryFn: () => boostsService.fetchBoostById(route.params.boostId), refetchInterval: 30_000 });
  if (!boost.data) {
    return (
      <Screen>
        <Header title="Boost" />
        <ActivityIndicator style={styles.loading} color={colors.primary} />
      </Screen>
    );
  }
  const details = boost.data;
  const metrics = [
    { label: "Impressions", value: details.results.impressions },
    { label: "People reached", value: details.results.reach },
    { label: "Profile visits", value: details.results.profileVisits },
    { label: "Messages", value: details.results.messages },
  ];
  return (
    <Screen>
      <Header title="Boost results" />
      <ScrollView contentContainerStyle={styles.content} refreshControl={<RefreshControl refreshing={boost.isRefetching} onRefresh={() => boost.refetch()} tintColor={colors.primary} />}>
        <View style={styles.card}>
          <StatusPill label={STATUS_APPEARANCE[details.status].label} tone={STATUS_APPEARANCE[details.status].tone} />
          <Text size={14} lineHeight={16.8} color={colors.textMuted}>
            Spent {formatMoneyForDisplay(details.spent)} of {formatMoneyForDisplay(details.totalBudget)}
          </Text>
          {details.startsAt && details.endsAt ? (
            <Text size={12} lineHeight={16.8} color={colors.textSubtle}>{formatFriendlyDate(details.startsAt)} – {formatFriendlyDate(details.endsAt)}</Text>
          ) : null}
          {details.rejectionReason ? <Text size={13} color={colors.error}>{details.rejectionReason}</Text> : null}
        </View>
        <View style={styles.grid}>
          {metrics.map((metric) => (
            <View key={metric.label} style={styles.metric}>
              <Text size={21} weight={600} lineHeight={25.2}>{formatCountWithThousandsSuffix(metric.value)}</Text>
              <Text size={12} lineHeight={16.8} color={colors.textMuted}>{metric.label}</Text>
            </View>
          ))}
        </View>
        <Button variant="subtle" title="View post" onPress={() => navigation.navigate("PostDetail", { postId: details.postId })} />
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  loading: { marginTop: 80 },
  content: { paddingHorizontal: 16, paddingTop: 8, paddingBottom: 40, gap: 16 },
  card: { backgroundColor: colors.white, borderRadius: 12, padding: 16, gap: 8 },
  grid: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  metric: { width: "48.5%", backgroundColor: colors.white, borderRadius: 12, padding: 16, gap: 4 },
});
