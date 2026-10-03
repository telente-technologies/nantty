import { useMutation, useQuery } from "@tanstack/react-query";
import { useRef, useState } from "react";
import { ActivityIndicator, ScrollView, StyleSheet, View } from "react-native";

import { SelectableRow } from "@/components/cart/selectableRow";
import { AdsManagerBanner } from "@/components/boost/adsManagerBanner";
import { BoostAudiencePicker } from "@/components/boost/boostAudiencePicker";
import { Button } from "@/components/ui/button";
import { Chip } from "@/components/ui/chip";
import { Header } from "@/components/ui/header";
import { Screen } from "@/components/ui/screen";
import { Text } from "@/components/ui/text";
import { useWalletBalanceQuery } from "@/components/wallet/walletQueries.hook";
import { makeThemedStyles, useTheme } from "@/theme";
import type { MainScreenProps } from "@/navigation/navigation.types";
import { generateIdempotencyKey } from "@/services/apiClient.service";
import { boostsService } from "@/services/boosts.service";
import { paymentsService } from "@/services/payments.service";
import { useAuthStore } from "@/store/auth.store";
import { useLocaleStore } from "@/store/locale.store";
import type { BoostAudience, BoostGoal } from "@/types/boost.type";
import type { Money } from "@/types";
import { formatMoneyForDisplay } from "@/utils/formatMoney.util";
import { ListSkeleton } from "@/components/ui/listSkeleton";

const GOALS: readonly { readonly id: BoostGoal; readonly label: string; readonly hint: string }[] = [
  { id: "views", label: "More views", hint: "Show your post to more people" },
  { id: "profile_visits", label: "More profile visits", hint: "Grow your followers" },
  { id: "messages", label: "More messages", hint: "Get people to message you" },
];

export function PromotePostScreen({ navigation, route }: MainScreenProps<"PromotePost">) {
  const { colors } = useTheme();
  const styles = useStyles();
  const { postId } = route.params;
  const signedInUser = useAuthStore((state) => state.user);
  const countryCode = useLocaleStore((state) => state.countryCode ?? state.deviceRegionCode ?? "NG");
  const options = useQuery({ queryKey: ["boosts", "options"], queryFn: boostsService.fetchBoostOptions });
  const { data: wallet } = useWalletBalanceQuery();
  const [goal, setGoal] = useState<BoostGoal>("views");
  const [audience, setAudience] = useState<BoostAudience>({ mode: "automatic" });
  const [chosenDailyBudget, setChosenDailyBudget] = useState<Money | null>(null);
  const [chosenDurationDays, setChosenDurationDays] = useState<number | null>(null);
  const [paymentMethod, setPaymentMethod] = useState<"wallet" | "card">("card");
  const idempotencyKey = useRef(generateIdempotencyKey());
  const dailyBudget = chosenDailyBudget ?? options.data?.suggestedDailyBudgets[1] ?? null;
  const durationDays = chosenDurationDays ?? options.data?.durationDayOptions[1] ?? null;
  const request = dailyBudget && durationDays ? { postId, goal, audience, dailyBudget, durationDays } : null;

  const estimate = useQuery({
    queryKey: ["boosts", "estimate", request],
    queryFn: () => boostsService.estimateBoostReach(request!),
    enabled: !!request,
  });
  const walletCanPay = !!wallet && !!estimate.data && wallet.available.currency === estimate.data.totalCost.currency && wallet.available.amountMinor >= estimate.data.totalCost.amountMinor;

  const startBoost = useMutation({
    mutationFn: async () => {
      const created = await boostsService.createBoost({ ...request!, paymentMethod }, idempotencyKey.current);
      if (created.checkoutUrl) await paymentsService.openHostedCheckoutInAppBrowser(created.checkoutUrl);
      return created.boost;
    },
    onSuccess: (boost) => navigation.replace("BoostStatus", { boostId: boost.id }),
  });

  if (!options.data) {
    return (
      <Screen>
        <Header title="Promote post" />
        <ListSkeleton />
      </Screen>
    );
  }

  return (
    <Screen>
      <Header title="Promote post" />
      <ScrollView contentContainerStyle={styles.content}>
        {signedInUser?.isSeller || signedInUser?.verification?.color === "gold" ? <AdsManagerBanner /> : null}
        <Text size={16} weight={600} lineHeight={19.2}>Goal</Text>
        {GOALS.map((option) => (
          <SelectableRow key={option.id} selected={goal === option.id} onPress={() => setGoal(option.id)} accessibilityLabel={option.label}>
            <Text size={14} weight={500} lineHeight={16.8}>{option.label}</Text>
            <Text size={12} lineHeight={16.8} color={colors.textMuted}>{option.hint}</Text>
          </SelectableRow>
        ))}
        <Text size={16} weight={600} lineHeight={19.2} style={styles.sectionTitle}>Audience</Text>
        <BoostAudiencePicker audience={audience} interestOptions={options.data.interests} countryCode={countryCode} onChange={setAudience} />
        <Text size={16} weight={600} lineHeight={19.2} style={styles.sectionTitle}>Daily budget</Text>
        <View style={styles.chips}>
          {options.data.suggestedDailyBudgets.map((budget) => (
            <Chip key={budget.amountMinor} kind="topic" label={formatMoneyForDisplay(budget, { showDecimals: false })} selected={dailyBudget?.amountMinor === budget.amountMinor} onPress={() => setChosenDailyBudget(budget)} />
          ))}
        </View>
        <Text size={16} weight={600} lineHeight={19.2} style={styles.sectionTitle}>Duration</Text>
        <View style={styles.chips}>
          {options.data.durationDayOptions.map((days) => (
            <Chip key={days} kind="topic" label={`${days} ${days === 1 ? "day" : "days"}`} selected={durationDays === days} onPress={() => setChosenDurationDays(days)} />
          ))}
        </View>
        <View style={styles.estimate} accessibilityLiveRegion="polite">
          {estimate.isFetching && !estimate.data ? <ActivityIndicator color={colors.primary} /> : null}
          {estimate.data ? (
            <>
              <Text size={13} lineHeight={16.9} color={colors.textMuted}>Estimated reach</Text>
              <Text size={21} weight={600} lineHeight={25.2}>
                {estimate.data.estimatedReachMin.toLocaleString()}–{estimate.data.estimatedReachMax.toLocaleString()} people
              </Text>
              <Text size={13} lineHeight={16.9}>{estimate.data.estimatedResultsLabel}</Text>
              <Text size={14} weight={600} lineHeight={16.8}>Total: {formatMoneyForDisplay(estimate.data.totalCost)}</Text>
            </>
          ) : null}
          {estimate.isError ? <Text size={12} color={colors.error}>{estimate.error.message}</Text> : null}
        </View>
        <Text size={16} weight={600} lineHeight={19.2} style={styles.sectionTitle}>Pay with</Text>
        <SelectableRow selected={paymentMethod === "wallet"} onPress={() => walletCanPay && setPaymentMethod("wallet")} accessibilityLabel="Zudomart wallet">
          <Text size={14} weight={500} lineHeight={16.8} color={walletCanPay ? colors.text : colors.textSubtle}>Zudomart wallet</Text>
          <Text size={12} lineHeight={16.8} color={colors.textMuted}>{wallet ? `${formatMoneyForDisplay(wallet.available)} available` : " "}</Text>
        </SelectableRow>
        <SelectableRow selected={paymentMethod === "card"} onPress={() => setPaymentMethod("card")} accessibilityLabel="Card or bank transfer">
          <Text size={14} weight={500} lineHeight={16.8}>Card or bank transfer</Text>
          <Text size={12} lineHeight={16.8} color={colors.textMuted}>Pay in a secure payment window</Text>
        </SelectableRow>
      </ScrollView>
      <View style={styles.footer}>
        {startBoost.isError ? <Text size={12} color={colors.error} align="center">{startBoost.error.message}</Text> : null}
        <Button title="Boost post" disabled={!estimate.data} loading={startBoost.isPending} onPress={() => startBoost.mutate()} />
      </View>
    </Screen>
  );
}

const useStyles = makeThemedStyles((colors) => StyleSheet.create({
  content: { paddingHorizontal: 16, paddingTop: 8, paddingBottom: 24, gap: 8 },
  sectionTitle: { marginTop: 12 },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  estimate: { backgroundColor: colors.surface, borderRadius: 12, padding: 16, gap: 4, marginTop: 12 },
  footer: { paddingHorizontal: 16, paddingTop: 8, paddingBottom: 24, gap: 8 },
}));
