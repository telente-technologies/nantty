import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useRef, useState } from "react";
import { ScrollView, StyleSheet, View } from "react-native";

import { BoostBudgetChangeSheet } from "@/components/ads/boostBudgetChangeSheet";
import { BoostResultsChart } from "@/components/ads/boostResultsChart";
import { AdsManagerBanner } from "@/components/boost/adsManagerBanner";
import { formatFriendlyDate } from "@/components/escrow/escrowStage.util";
import { StatusPill } from "@/components/escrow/statusPill";
import { Button } from "@/components/ui/button";
import { ErrorState } from "@/components/ui/errorState";
import { Header } from "@/components/ui/header";
import { ListSkeleton } from "@/components/ui/listSkeleton";
import { usePullToRefresh } from "@/components/ui/pullToRefresh.hook";
import { Screen } from "@/components/ui/screen";
import { Text } from "@/components/ui/text";
import { spacing } from "@/constants/spacing.constant";
import { typeScale } from "@/constants/typography.constant";
import type { MainScreenProps } from "@/navigation/navigation.types";
import { adsHubService } from "@/services/ads/adsHub.service";
import { generateIdempotencyKey } from "@/services/core/apiClient.service";
import { boostsService } from "@/services/feed/boosts.service";
import { makeThemedStyles, useTheme } from "@/theme";
import type { Boost } from "@/types/boost.type";
import { boostAvailableActions, boostStatusAppearance } from "@/utils/adsHub.util";
import { boostDestinationOf, boostResultMetricsFor, boostViewTargetLabelFor } from "@/utils/boostDestination.util";
import { boostErrorMessage, describeBoostPaymentMethodForDisplay } from "@/utils/boostPayment.util";
import { showAlertWithButtons } from "@/utils/crossPlatformAlert.util";
import { formatCountWithThousandsSuffix } from "@/utils/formatDate.util";
import { formatMoneyForDisplay } from "@/utils/formatMoney.util";

type StatusAction = "pause" | "resume" | "stop";

export function BoostStatusScreen({ navigation, route }: MainScreenProps<"BoostStatus">) {
  const { colors } = useTheme();
  const styles = useStyles();
  const queryClient = useQueryClient();
  const boostId = route.params.boostId;
  const [budgetSheetVisible, setBudgetSheetVisible] = useState(false);
  const actionKeys = useRef(new Map<string, string>()).current;
  const boost = useQuery({ queryKey: ["boosts", boostId], queryFn: () => boostsService.fetchBoostById(boostId), refetchInterval: (query) => (query.state.data?.status === "pending_payment" ? 5_000 : 30_000) });
  const report = useQuery({ queryKey: ["ads", "report", boostId], queryFn: () => adsHubService.fetchBoostReport(boostId), enabled: !!boost.data && boost.data.status !== "pending_payment" });
  const options = useQuery({ queryKey: ["boosts", "options"], queryFn: boostsService.fetchBoostOptions, enabled: budgetSheetVisible });
  const refreshControl = usePullToRefresh(boost.refetch, report.refetch);
  const changeStatus = useMutation({
    mutationFn: (action: StatusAction) => {
      const actionKey = `${action}:${boost.data?.status}`;
      const idempotencyKey = actionKeys.get(actionKey) ?? generateIdempotencyKey();
      actionKeys.set(actionKey, idempotencyKey);
      if (action === "pause") return adsHubService.pauseBoost(boostId, idempotencyKey);
      if (action === "resume") return adsHubService.resumeBoost(boostId, idempotencyKey);
      return adsHubService.stopBoost(boostId, idempotencyKey);
    },
    onSuccess: (updated: Boost) => {
      queryClient.setQueryData(["boosts", boostId], updated);
      void queryClient.invalidateQueries({ queryKey: ["ads"] });
    },
    onSettled: () => void boost.refetch(),
  });

  if (!boost.data) {
    return (
      <Screen>
        <Header title="Ad" />
        {boost.isError ? <ErrorState error={boost.error} message="Couldn't load this ad." onRetry={() => boost.refetch()} retrying={boost.isRefetching} /> : <ListSkeleton />}
      </Screen>
    );
  }
  const details = boost.data;
  const appearance = boostStatusAppearance(details.status);
  const actions = boostAvailableActions(details);
  const destination = boostDestinationOf(details);
  const totals = report.data?.totals;
  const metrics = totals
    ? [
        { label: "Impressions", value: formatCountWithThousandsSuffix(totals.impressions) },
        { label: "People reached", value: formatCountWithThousandsSuffix(totals.reach) },
        { label: destination.type === "post" ? "Taps" : `${destination.type === "store" ? "Store" : destination.type === "product" ? "Product" : "Profile"} visits (ad taps)`, value: formatCountWithThousandsSuffix(totals.clicks) },
        { label: report.data!.resultLabel || "Results", value: formatCountWithThousandsSuffix(totals.results) },
        { label: "Spent", value: formatMoneyForDisplay(totals.spend) },
        { label: "Cost per result", value: totals.costPerResult ? formatMoneyForDisplay(totals.costPerResult) : "—" },
      ]
    : [
        ...boostResultMetricsFor(details).map((metric) => ({ label: metric.label, value: formatCountWithThousandsSuffix(metric.value) })),
        { label: "Spent", value: formatMoneyForDisplay(details.spent) },
        { label: "Cost per result", value: details.costPerResult ? formatMoneyForDisplay(details.costPerResult) : "—" },
      ];
  const openPromotedTarget = () => {
    if (destination.type === "store") navigation.navigate("Store", { storeId: destination.targetId });
    else if (destination.type === "profile") navigation.navigate("UserProfile", { userId: destination.targetId });
    else if (destination.type === "product") navigation.navigate("ProductDetail", { productId: destination.targetId });
    else navigation.navigate("PostDetail", { postId: destination.targetId });
  };
  const confirmStop = () =>
    showAlertWithButtons("Stop this ad?", "It stops showing right away and can't be restarted. Unspent budget is returned the same way you paid (card payments stay in your ad balance).", [
      { text: "Keep running", style: "cancel" },
      { text: "Stop ad", style: "destructive", onPress: () => changeStatus.mutate("stop") },
    ]);
  const paidWith = describeBoostPaymentMethodForDisplay(details.paymentMethod);

  return (
    <Screen>
      <Header title="Ad results" />
      <ScrollView contentContainerStyle={styles.content} refreshControl={refreshControl}>
        <View style={styles.card}>
          <StatusPill label={appearance.label} tone={appearance.tone} />
          <Text size={typeScale.md} lineHeight={16.8} color={colors.textMuted}>Spent {formatMoneyForDisplay(details.spent)} of {formatMoneyForDisplay(details.totalBudget)}</Text>
          {paidWith ? <Text size={typeScale.xs} lineHeight={16.8} color={colors.textSubtle}>Paid with {paidWith}</Text> : null}
          {details.startsAt && details.endsAt ? <Text size={typeScale.xs} lineHeight={16.8} color={colors.textSubtle}>{formatFriendlyDate(details.startsAt)} – {formatFriendlyDate(details.endsAt)}</Text> : null}
          {!details.startsAt && details.scheduledStartAt ? <Text size={typeScale.xs} lineHeight={16.8} color={colors.textSubtle}>Starts {formatFriendlyDate(details.scheduledStartAt)} after approval</Text> : null}
          {details.status === "pending_payment" ? <Text size={typeScale.xs} lineHeight={16.8} color={colors.textSubtle}>Waiting for your payment to be confirmed. This updates on its own.</Text> : null}
          {details.status === "in_review" ? <Text size={typeScale.xs} lineHeight={16.8} color={colors.textSubtle}>We review ads before they run, usually within a day.</Text> : null}
          {details.rejectionReason ? (
            <View style={styles.rejection}>
              <Text size={typeScale.sm} weight={600}>Why it wasn't approved</Text>
              <Text size={typeScale.sm} color={colors.error}>{details.rejectionReason}</Text>
              <Text size={typeScale.xs} lineHeight={16} color={colors.textMuted}>What you paid stays in your ad balance.</Text>
            </View>
          ) : null}
        </View>
        <View style={styles.actions}>
          {actions.resubmit ? <Button title="Edit and resubmit" onPress={() => navigation.navigate("CreateAd", { fromBoostId: details.id, mode: "resubmit" })} /> : null}
          {actions.pause ? <Button variant="subtle" title="Pause" loading={changeStatus.isPending && changeStatus.variables === "pause"} disabled={changeStatus.isPending} onPress={() => changeStatus.mutate("pause")} /> : null}
          {actions.resume ? <Button variant="subtle" title="Resume" loading={changeStatus.isPending && changeStatus.variables === "resume"} disabled={changeStatus.isPending} onPress={() => changeStatus.mutate("resume")} /> : null}
          {actions.changeBudget ? <Button variant="subtle" title="Extend or increase budget" onPress={() => setBudgetSheetVisible(true)} /> : null}
          <Button variant="subtle" title="Duplicate" onPress={() => navigation.navigate("CreateAd", { fromBoostId: details.id, mode: "duplicate" })} />
          {actions.stop ? <Button variant="danger" title="Stop ad" loading={changeStatus.isPending && changeStatus.variables === "stop"} disabled={changeStatus.isPending} onPress={confirmStop} /> : null}
          {changeStatus.isError ? <Text size={typeScale.xs} color={colors.error} accessibilityLiveRegion="assertive">{boostErrorMessage(changeStatus.error)}</Text> : null}
        </View>
        <Text size={typeScale.base} weight={600}>Results</Text>
        <View style={styles.grid}>
          {metrics.map((metric) => (
            <View key={metric.label} style={styles.metric} accessible accessibilityLabel={`${metric.label}: ${metric.value}`}>
              <Text size={20} weight={600} lineHeight={24}>{metric.value}</Text>
              <Text size={typeScale.xs} lineHeight={16.8} color={colors.textMuted}>{metric.label}</Text>
            </View>
          ))}
        </View>
        {report.isError ? <ErrorState error={report.error} message="Couldn't load the daily results." variant="inline" onRetry={() => report.refetch()} /> : null}
        {report.data ? <BoostResultsChart series={report.data.series} /> : null}
        <Text size={typeScale.xs} lineHeight={16} color={colors.textMuted}>
          What we track: impressions, people reached, taps on your ad (shown as visits) and conversations started from it. Followers gained aren't tracked. Results can take a few hours to appear.
        </Text>
        <Button variant="subtle" title={boostViewTargetLabelFor(destination.type)} onPress={openPromotedTarget} />
        <AdsManagerBanner />
      </ScrollView>
      {budgetSheetVisible ? <BoostBudgetChangeSheet visible boost={details} options={options.data} onClose={() => setBudgetSheetVisible(false)} /> : null}
    </Screen>
  );
}

const useStyles = makeThemedStyles((colors) => StyleSheet.create({
  content: { paddingHorizontal: spacing[4], paddingTop: spacing[2], paddingBottom: spacing[8], gap: spacing[4] },
  card: { backgroundColor: colors.surface, borderRadius: 12, padding: spacing[4], gap: spacing[2] },
  rejection: { gap: spacing[1], marginTop: spacing[1] },
  actions: { gap: spacing[2] },
  grid: { flexDirection: "row", flexWrap: "wrap", gap: spacing[2] },
  metric: { width: "48.5%", backgroundColor: colors.surface, borderRadius: 12, padding: spacing[4], gap: spacing[1] },
}));
