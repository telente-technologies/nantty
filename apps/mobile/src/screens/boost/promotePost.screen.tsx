import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useRef, useState } from "react";
import { ActivityIndicator, ScrollView, StyleSheet, View } from "react-native";

import { SelectableRow } from "@/components/cart/selectableRow";
import { AdsManagerBanner } from "@/components/boost/adsManagerBanner";
import { BoostAudiencePicker } from "@/components/boost/boostAudiencePicker";
import { BoostPaymentPicker } from "@/components/boost/boostPaymentPicker";
import { useCountryRequiredRetry } from "@/components/checkout/countryRequiredSheet";
import { Button } from "@/components/ui/button";
import { Chip } from "@/components/ui/chip";
import { Header } from "@/components/ui/header";
import { Screen } from "@/components/ui/screen";
import { Text } from "@/components/ui/text";
import { makeThemedStyles, useTheme } from "@/theme";
import type { MainScreenProps } from "@/navigation/navigation.types";
import { ApiError, generateIdempotencyKey } from "@/services/core/apiClient.service";
import { boostsService } from "@/services/feed/boosts.service";
import { paymentsService } from "@/services/commerce/payments.service";
import { useAuthStore } from "@/store/auth.store";
import { useLocaleStore } from "@/store/locale.store";
import type { BoostAudience, BoostGoal, CreateBoostRequest } from "@/types/boost.type";
import type { Money } from "@/types";
import {
  FREE_BOOST_ERROR_CODES, boostErrorMessage, fitsWithinFreeBoost, nativeBoostPaymentMethods, pickFreeBoostSelection, usableFreeBoost,
  type NativeBoostPaymentMethod,
} from "@/utils/boostPayment.util";
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
  const queryClient = useQueryClient();
  const options = useQuery({ queryKey: ["boosts", "options"], queryFn: boostsService.fetchBoostOptions });
  const [goal, setGoal] = useState<BoostGoal>("views");
  const [audience, setAudience] = useState<BoostAudience>({ mode: "automatic" });
  const [chosenDailyBudget, setChosenDailyBudget] = useState<Money | null>(null);
  const [chosenDurationDays, setChosenDurationDays] = useState<number | null>(null);
  const [chosenPaymentMethod, setChosenPaymentMethod] = useState<NativeBoostPaymentMethod | null>(null);
  const idempotency = useRef<{ readonly body: string; readonly key: string } | null>(null);
  const cardAllowed = nativeBoostPaymentMethods(options.data).includes("card");
  const freeBoost = usableFreeBoost(options.data);
  const usedFreeBoost = !freeBoost && options.data?.freeBoost?.premium && options.data.freeBoost.remainingThisMonth <= 0 ? options.data.freeBoost : null;
  const freeSelection = useMemo(() => (options.data && freeBoost ? pickFreeBoostSelection(options.data, freeBoost) : null), [options.data, freeBoost]);
  const paymentMethod: NativeBoostPaymentMethod = freeSelection && (chosenPaymentMethod !== "card" || !cardAllowed) ? "free" : "card";
  const defaults = paymentMethod === "free" && freeSelection ? freeSelection : {
    dailyBudget: options.data?.suggestedDailyBudgets[1] ?? options.data?.suggestedDailyBudgets[0] ?? null,
    durationDays: options.data?.durationDayOptions[1] ?? options.data?.durationDayOptions[0] ?? null,
  };
  const dailyBudget = chosenDailyBudget ?? defaults.dailyBudget;
  const durationDays = chosenDurationDays ?? defaults.durationDays;
  const request = dailyBudget && durationDays ? { postId, goal, audience, dailyBudget, durationDays } : null;

  const estimate = useQuery({
    queryKey: ["boosts", "estimate", request],
    queryFn: () => boostsService.estimateBoostReach(request!),
    enabled: !!request,
  });
  const freeBoostFits = !freeBoost || !estimate.data || fitsWithinFreeBoost(estimate.data.totalCost, freeBoost);
  const canPay = paymentMethod === "free" ? !!freeBoost && freeBoostFits : cardAllowed;

  const chooseBudgetAndDuration = (nextDailyBudget: Money, nextDurationDays: number) => {
    setChosenDailyBudget(nextDailyBudget);
    setChosenDurationDays(nextDurationDays);
    const total = { amountMinor: nextDailyBudget.amountMinor * nextDurationDays, currency: nextDailyBudget.currency };
    setChosenPaymentMethod(paymentMethod === "free" && freeBoost && fitsWithinFreeBoost(total, freeBoost) ? "free" : "card");
  };
  const chooseFreeBoost = () => {
    if (!freeSelection) return;
    setChosenPaymentMethod("free");
    setChosenDailyBudget(freeSelection.dailyBudget);
    setChosenDurationDays(freeSelection.durationDays);
  };
  const { retry: countryRetry, sheet: countrySheet } = useCountryRequiredRetry();
  const idempotencyKeyFor = (body: CreateBoostRequest) => {
    const signature = JSON.stringify(body);
    if (idempotency.current?.body !== signature) idempotency.current = { body: signature, key: generateIdempotencyKey() };
    return idempotency.current.key;
  };

  const startBoost = useMutation({
    mutationFn: async () => {
      const body: CreateBoostRequest = { ...request!, paymentMethod };
      const created = await boostsService.createBoost(body, idempotencyKeyFor(body));
      if (created.checkoutUrl) await paymentsService.openHostedCheckoutInAppBrowser(created.checkoutUrl);
      return created.boost;
    },
    onSuccess: (boost) => {
      if (paymentMethod === "free") queryClient.invalidateQueries({ queryKey: ["boosts", "options"] });
      navigation.replace("BoostStatus", { boostId: boost.id });
    },
    onError: (error) => {
      if (error instanceof ApiError && countryRetry.handle(error.code, () => {
        idempotency.current = null;
        startBoost.mutate();
      })) return;
      if (!(error instanceof ApiError) || !error.code || !FREE_BOOST_ERROR_CODES.has(error.code)) return;
      queryClient.invalidateQueries({ queryKey: ["boosts", "options"] });
      if (error.code !== "FREE_BOOST_TOO_LARGE" && cardAllowed) setChosenPaymentMethod("card");
    },
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
      {countrySheet}
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
        {options.data.packages && options.data.packages.length > 0 ? (
          <>
            <Text size={16} weight={600} lineHeight={19.2} style={styles.sectionTitle}>Packages</Text>
            {options.data.packages.map((boostPackage) => {
              const daily = { amountMinor: Math.floor(boostPackage.priceMinor / boostPackage.days), currency: boostPackage.currency };
              const selected = durationDays === boostPackage.days && dailyBudget?.amountMinor === daily.amountMinor;
              return (
                <SelectableRow key={`${boostPackage.label}-${boostPackage.priceMinor}`} selected={selected} onPress={() => chooseBudgetAndDuration(daily, boostPackage.days)} accessibilityLabel={`${boostPackage.label} package`}>
                  <Text size={14} weight={500} lineHeight={16.8}>{formatMoneyForDisplay({ amountMinor: boostPackage.priceMinor, currency: boostPackage.currency }, { showDecimals: false })} · {boostPackage.label}</Text>
                  <Text size={12} lineHeight={16.8} color={colors.textMuted}>About {boostPackage.estimatedReach.low.toLocaleString()}–{boostPackage.estimatedReach.high.toLocaleString()} people</Text>
                </SelectableRow>
              );
            })}
          </>
        ) : null}
        <Text size={16} weight={600} lineHeight={19.2} style={styles.sectionTitle}>Daily budget</Text>
        <View style={styles.chips}>
          {options.data.suggestedDailyBudgets.map((budget) => (
            <Chip key={budget.amountMinor} kind="topic" label={formatMoneyForDisplay(budget, { showDecimals: false })} selected={dailyBudget?.amountMinor === budget.amountMinor} onPress={() => chooseBudgetAndDuration(budget, durationDays ?? 1)} />
          ))}
        </View>
        <Text size={16} weight={600} lineHeight={19.2} style={styles.sectionTitle}>Duration</Text>
        <View style={styles.chips}>
          {options.data.durationDayOptions.map((days) => (
            <Chip key={days} kind="topic" label={`${days} ${days === 1 ? "day" : "days"}`} selected={durationDays === days} onPress={() => (dailyBudget ? chooseBudgetAndDuration(dailyBudget, days) : setChosenDurationDays(days))} />
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
              {estimate.data.impressions ? <Text size={13} lineHeight={16.9} color={colors.textMuted}>{estimate.data.impressions.low.toLocaleString()}–{estimate.data.impressions.high.toLocaleString()} impressions over {durationDays} {durationDays === 1 ? "day" : "days"}</Text> : null}
              {estimate.data.costPerResultMinor ? (
                <Text size={13} lineHeight={16.9} color={colors.textMuted}>
                  Cost per result: {formatMoneyForDisplay({ amountMinor: estimate.data.costPerResultMinor.low, currency: estimate.data.totalCost.currency })}–{formatMoneyForDisplay({ amountMinor: estimate.data.costPerResultMinor.high, currency: estimate.data.totalCost.currency })}
                </Text>
              ) : null}
              {estimate.data.minimumDailyBudget ? <Text size={12} lineHeight={16.8} color={colors.textMuted}>Minimum daily budget here: {formatMoneyForDisplay(estimate.data.minimumDailyBudget)}</Text> : null}
              <Text size={14} weight={600} lineHeight={16.8}>
                {paymentMethod === "free" && freeBoostFits ? `Total: Free (usually ${formatMoneyForDisplay(estimate.data.totalCost)})` : `Total: ${formatMoneyForDisplay(estimate.data.totalCost)}`}
              </Text>
            </>
          ) : null}
          {estimate.isError ? <Text size={12} color={colors.error}>{estimate.error.message}</Text> : null}
        </View>
        <Text size={16} weight={600} lineHeight={19.2} style={styles.sectionTitle}>Pay with</Text>
        <BoostPaymentPicker
          paymentMethod={paymentMethod}
          cardAllowed={cardAllowed}
          freeBoost={freeSelection ? freeBoost : null}
          freeBoostFits={freeBoostFits}
          usedFreeBoost={usedFreeBoost}
          totalCost={estimate.data?.totalCost ?? null}
          onSelectCard={() => setChosenPaymentMethod("card")}
          onSelectFree={chooseFreeBoost}
        />
      </ScrollView>
      <View style={styles.footer}>
        {startBoost.isError ? <Text size={12} color={colors.error} align="center">{boostErrorMessage(startBoost.error)}</Text> : null}
        <Button
          title={paymentMethod === "free" ? "Use free boost" : estimate.data ? `Boost post · ${formatMoneyForDisplay(estimate.data.totalCost)}` : "Boost post"}
          disabled={!estimate.data || !canPay}
          loading={startBoost.isPending}
          onPress={() => startBoost.mutate()}
        />
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
