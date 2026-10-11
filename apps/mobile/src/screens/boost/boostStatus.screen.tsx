import { useQuery } from "@tanstack/react-query";
import { RefreshControl, ScrollView, StyleSheet, View } from "react-native";

import { formatFriendlyDate } from "@/components/escrow/escrowStage.util";
import { StatusPill, type StatusTone } from "@/components/escrow/statusPill";
import { Button } from "@/components/ui/button";
import { Header } from "@/components/ui/header";
import { Screen } from "@/components/ui/screen";
import { Text } from "@/components/ui/text";
import { makeThemedStyles, useTheme } from "@/theme";
import type { MainScreenProps } from "@/navigation/navigation.types";
import { boostsService } from "@/services/feed/boosts.service";
import type { Boost } from "@/types/boost.type";
import { formatCountWithThousandsSuffix } from "@/utils/formatDate.util";
import { formatMoneyForDisplay } from "@/utils/formatMoney.util";
import { ErrorState } from "@/components/ui/errorState";
import { ListSkeleton } from "@/components/ui/listSkeleton";
import { spacing } from "@/constants/spacing.constant";
import { typeScale } from "@/constants/typography.constant";

const STATUS_APPEARANCE: Record<Boost["status"], { label: string; tone: StatusTone }> = {
  pending_payment: { label: "Waiting for payment", tone: "neutral" },
  in_review: { label: "In review", tone: "caution" },
  active: { label: "Running", tone: "primary" },
  completed: { label: "Completed", tone: "success" },
  rejected: { label: "Not approved", tone: "error" },
  cancelled: { label: "Stopped", tone: "neutral" },
};

export function BoostStatusScreen({ navigation, route }: MainScreenProps<"BoostStatus">) {
  const { colors } = useTheme();
  const styles = useStyles();
  const boost = useQuery({ queryKey: ["boosts", route.params.boostId], queryFn: () => boostsService.fetchBoostById(route.params.boostId), refetchInterval: (query) => (query.state.data?.status === "pending_payment" ? 5_000 : 30_000) });
  if (!boost.data) {
    return (
      <Screen>
        <Header title="Boost" />
        {boost.isError ? <ErrorState error={boost.error} message="Couldn't load this boost." onRetry={() => boost.refetch()} retrying={boost.isRefetching} /> : <ListSkeleton />}
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
      <ScrollView contentContainerStyle={styles.content} refreshControl={<RefreshControl refreshing={boost.isRefetching} onRefresh={() => boost.refetch()} tintColor={colors.primary} colors={[colors.primary]} />}>
        <View style={styles.card}>
          <StatusPill label={STATUS_APPEARANCE[details.status].label} tone={STATUS_APPEARANCE[details.status].tone} />
          <Text size={typeScale.md} lineHeight={16.8} color={colors.textMuted}>
            Spent {formatMoneyForDisplay(details.spent)} of {formatMoneyForDisplay(details.totalBudget)}
          </Text>
          {details.paymentMethod === "free" ? <Text size={typeScale.xs} lineHeight={16.8} color={colors.textSubtle}>Covered by your free Premium boost</Text> : null}
          {details.startsAt && details.endsAt ? (
            <Text size={typeScale.xs} lineHeight={16.8} color={colors.textSubtle}>{formatFriendlyDate(details.startsAt)} – {formatFriendlyDate(details.endsAt)}</Text>
          ) : null}
          {details.rejectionReason ? <Text size={typeScale.sm} color={colors.error}>{details.rejectionReason}</Text> : null}
        </View>
        <View style={styles.grid}>
          {metrics.map((metric) => (
            <View key={metric.label} style={styles.metric}>
              <Text size={21} weight={600} lineHeight={25.2}>{formatCountWithThousandsSuffix(metric.value)}</Text>
              <Text size={typeScale.xs} lineHeight={16.8} color={colors.textMuted}>{metric.label}</Text>
            </View>
          ))}
        </View>
        <Button variant="subtle" title="View post" onPress={() => navigation.navigate("PostDetail", { postId: details.postId })} />
      </ScrollView>
    </Screen>
  );
}

const useStyles = makeThemedStyles((colors) => StyleSheet.create({
  content: { paddingHorizontal: spacing[4], paddingTop: spacing[2], paddingBottom: spacing[8], gap: spacing[4] },
  card: { backgroundColor: colors.surface, borderRadius: 12, padding: spacing[4], gap: spacing[2] },
  grid: { flexDirection: "row", flexWrap: "wrap", gap: spacing[2] },
  metric: { width: "48.5%", backgroundColor: colors.surface, borderRadius: 12, padding: spacing[4], gap: spacing[1] },
}));
