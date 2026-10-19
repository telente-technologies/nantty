import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { ActivityIndicator, ScrollView, StyleSheet, View } from "react-native";

import { AdPreview } from "@/components/ads/adPreview";
import { CreateAdAudienceEditor } from "@/components/ads/createAdAudienceEditor";
import { CreateAdBudgetEditor } from "@/components/ads/createAdBudgetEditor";
import { CreateAdDestinationPicker } from "@/components/ads/createAdDestinationPicker";
import { CreateAdPaymentPicker } from "@/components/ads/createAdPaymentPicker";
import { AdsManagerBanner } from "@/components/boost/adsManagerBanner";
import { SelectableRow } from "@/components/cart/selectableRow";
import { useCountryRequiredRetry } from "@/components/checkout/countryRequiredSheet";
import { Button } from "@/components/ui/button";
import { ErrorState } from "@/components/ui/errorState";
import { Header } from "@/components/ui/header";
import { ListSkeleton } from "@/components/ui/listSkeleton";
import { Screen } from "@/components/ui/screen";
import { Text } from "@/components/ui/text";
import { describeActionFailure } from "@/errors/errorExperience/describeError";
import type { MainScreenProps } from "@/navigation/navigation.types";
import { paymentsService } from "@/services/commerce/payments.service";
import { ApiError, generateIdempotencyKey } from "@/services/core/apiClient.service";
import { boostsService } from "@/services/feed/boosts.service";
import { useAuthStore } from "@/store/auth.store";
import { useLocaleStore } from "@/store/locale.store";
import { makeThemedStyles, useTheme } from "@/theme";
import type { BoostDestinationType, BoostPaymentMethod, CreateBoostRequest } from "@/types/boost.type";
import {
  EMPTY_CREATE_AD_DRAFT, boostPaymentChoices, budgetBelowMinimum, buildBoostEstimateRequest, createAdDraftFromBoost, createStableIdempotencyKeys,
  goalsForDestination, resolvePaymentMethod, type CreateAdDraft,
} from "@/utils/adsHub.util";
import { FREE_BOOST_ERROR_CODES, boostErrorMessage } from "@/utils/boostPayment.util";
import { formatMoneyForDisplay } from "@/utils/formatMoney.util";

const STEP_TITLES = ["What to promote", "Goal and audience", "Budget and schedule", "Preview and pay"] as const;

export function CreateAdScreen({ navigation, route }: MainScreenProps<"CreateAd">) {
  const { colors } = useTheme();
  const styles = useStyles();
  const params = route.params;
  const queryClient = useQueryClient();
  const signedInUser = useAuthStore((state) => state.user);
  const countryCode = useLocaleStore((state) => state.countryCode ?? state.deviceRegionCode ?? "NG");
  const presetDestination = params?.destinationType && params.targetId ? { type: params.destinationType, targetId: params.targetId } : null;
  const [draft, setDraft] = useState<CreateAdDraft>({ ...EMPTY_CREATE_AD_DRAFT, destination: presetDestination });
  const [destinationType, setDestinationType] = useState<BoostDestinationType | null>(presetDestination?.type ?? null);
  const [step, setStep] = useState(presetDestination ? 1 : 0);
  const [chosenPaymentMethod, setChosenPaymentMethod] = useState<BoostPaymentMethod | null>(null);
  const idempotencyKeys = useRef(createStableIdempotencyKeys(generateIdempotencyKey)).current;
  const prefilledFromBoostId = useRef<string | null>(null);
  const options = useQuery({ queryKey: ["boosts", "options"], queryFn: boostsService.fetchBoostOptions });
  const sourceBoost = useQuery({ queryKey: ["boosts", params?.fromBoostId], queryFn: () => boostsService.fetchBoostById(params!.fromBoostId!), enabled: !!params?.fromBoostId });

  useEffect(() => {
    if (!sourceBoost.data || prefilledFromBoostId.current === sourceBoost.data.id) return;
    prefilledFromBoostId.current = sourceBoost.data.id;
    const prefilled = createAdDraftFromBoost(sourceBoost.data);
    setDraft(prefilled);
    setDestinationType(prefilled.destination?.type ?? null);
    setStep(1);
  }, [sourceBoost.data]);

  const optionsData = options.data;
  const goals = draft.destination ? goalsForDestination(draft.destination.type, optionsData) : [];
  const goal = draft.goal && goals.some((option) => option.id === draft.goal) ? draft.goal : goals[0]?.id ?? null;
  const effectiveDraft: CreateAdDraft = {
    ...draft,
    goal,
    dailyBudget: draft.dailyBudget ?? optionsData?.suggestedDailyBudgets[1] ?? optionsData?.suggestedDailyBudgets[0] ?? null,
    durationDays: draft.durationDays ?? optionsData?.durationDayOptions[1] ?? optionsData?.durationDayOptions[0] ?? null,
  };
  const request = buildBoostEstimateRequest(effectiveDraft);
  const belowMinimum = budgetBelowMinimum(effectiveDraft, optionsData);
  const estimate = useQuery({
    queryKey: ["boosts", "estimate", request],
    queryFn: () => boostsService.estimateBoostReach(request!),
    enabled: !!request && step >= 1 && !belowMinimum,
  });
  const total = estimate.data?.totalCost ?? null;
  const choices = boostPaymentChoices(optionsData, total);
  const paymentMethod = resolvePaymentMethod(choices, chosenPaymentMethod);
  const patchDraft = (patch: Partial<CreateAdDraft>) =>
    setDraft((current) => ({ ...current, dailyBudget: current.dailyBudget ?? effectiveDraft.dailyBudget, durationDays: current.durationDays ?? effectiveDraft.durationDays, ...patch }));
  const { retry: countryRetry, sheet: countrySheet } = useCountryRequiredRetry();

  const submit = useMutation({
    mutationFn: async () => {
      const body: CreateBoostRequest = { ...request!, paymentMethod: paymentMethod! };
      const created = await boostsService.createBoost(body, idempotencyKeys.keyFor(body));
      if (created.checkoutUrl) await paymentsService.openHostedCheckoutInAppBrowser(created.checkoutUrl);
      return created.boost;
    },
    onSuccess: (boost) => {
      idempotencyKeys.reset();
      void queryClient.invalidateQueries({ queryKey: ["ads"] });
      void queryClient.invalidateQueries({ queryKey: ["boosts", "options"] });
      navigation.replace("BoostStatus", { boostId: boost.id });
    },
    onError: (error) => {
      if (error instanceof ApiError && countryRetry.handle(error.code, () => {
        idempotencyKeys.reset();
        submit.mutate();
      })) return;
      if (error instanceof ApiError && error.code && (FREE_BOOST_ERROR_CODES.has(error.code) || error.code === "INSUFFICIENT_AD_BALANCE" || error.code === "VERIFICATION_REQUIRED")) {
        void queryClient.invalidateQueries({ queryKey: ["boosts", "options"] });
        setChosenPaymentMethod(null);
      }
    },
  });

  const title = params?.mode === "resubmit" ? "Edit and resubmit" : params?.mode === "duplicate" ? "Duplicate ad" : "Create ad";
  const goBack = () => (step > 0 ? setStep(step - 1) : navigation.goBack());

  if (!optionsData || (params?.fromBoostId && !sourceBoost.data)) {
    const failure = options.error ?? sourceBoost.error;
    return (
      <Screen>
        <Header title={title} />
        {failure ? <ErrorState error={failure} message="Couldn't load ad options." onRetry={() => { void options.refetch(); void sourceBoost.refetch(); }} retrying={options.isRefetching || sourceBoost.isRefetching} /> : <ListSkeleton />}
      </Screen>
    );
  }

  const canContinue = step === 0 ? !!draft.destination : step === 1 ? !!goal : step === 2 ? !!request && !belowMinimum && !!estimate.data : !!request && !!paymentMethod && !!estimate.data;

  return (
    <Screen>
      <Header title={title} onBack={goBack} />
      {countrySheet}
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <Text size={12} lineHeight={16} color={colors.textMuted} accessibilityRole="header">Step {step + 1} of {STEP_TITLES.length} · {STEP_TITLES[step]}</Text>
        {params?.mode === "resubmit" && sourceBoost.data?.rejectionReason ? (
          <View style={styles.notice} accessibilityLiveRegion="polite">
            <Text size={13} weight={600} lineHeight={16.9}>Why it wasn't approved</Text>
            <Text size={13} lineHeight={16.9} color={colors.error}>{sourceBoost.data.rejectionReason}</Text>
            <Text size={12} lineHeight={16} color={colors.textMuted}>Fix the issue, then submit again. What you paid for the rejected ad stays in your ad balance, so you can pay from it.</Text>
          </View>
        ) : null}
        {step === 0 && signedInUser ? (
          <CreateAdDestinationPicker
            signedInUserId={signedInUser.id}
            storeId={signedInUser.storeId ?? null}
            destination={draft.destination}
            destinationType={destinationType}
            onChooseType={(type) => {
              setDestinationType(type);
              if (draft.destination?.type !== type) patchDraft({ destination: null, goal: null });
            }}
            onChooseDestination={(destination) => patchDraft({ destination, goal: null })}
          />
        ) : null}
        {step === 1 ? (
          <>
            <Text size={14} weight={600} lineHeight={16.8}>Goal</Text>
            {goals.map((option) => (
              <SelectableRow key={option.id} selected={goal === option.id} onPress={() => patchDraft({ goal: option.id })} accessibilityLabel={option.hint ? `${option.label}. ${option.hint}` : option.label}>
                <Text size={14} weight={500} lineHeight={16.8}>{option.label}</Text>
                {option.hint ? <Text size={12} lineHeight={16.8} color={colors.textMuted}>{option.hint}</Text> : null}
              </SelectableRow>
            ))}
            <Text size={14} weight={600} lineHeight={16.8} style={styles.section}>Audience</Text>
            <CreateAdAudienceEditor audience={draft.audience} defaultCountryCode={countryCode} onChange={(audience) => patchDraft({ audience })} />
          </>
        ) : null}
        {step === 2 ? <CreateAdBudgetEditor draft={effectiveDraft} options={optionsData} onChange={patchDraft} /> : null}
        {step >= 1 ? (
          <View style={styles.estimate} accessibilityLiveRegion="polite">
            {estimate.isFetching && !estimate.data ? <ActivityIndicator color={colors.primary} accessibilityLabel="Estimating reach" /> : null}
            {estimate.data ? (
              <>
                <Text size={12} lineHeight={16} color={colors.textMuted}>Estimated reach</Text>
                <Text size={18} weight={600} lineHeight={22}>{estimate.data.estimatedReachMin.toLocaleString()}–{estimate.data.estimatedReachMax.toLocaleString()} people</Text>
                <Text size={13} lineHeight={16.9}>{estimate.data.estimatedResultsLabel}</Text>
                <Text size={14} weight={600} lineHeight={16.8}>Total: {formatMoneyForDisplay(estimate.data.totalCost)}</Text>
                <Text size={11} lineHeight={14} color={colors.textMuted}>Estimates, not guarantees. The price is set by Zudomart for your region.</Text>
              </>
            ) : null}
            {estimate.isError ? <Text size={12} lineHeight={16} color={colors.error}>{describeActionFailure(estimate.error)}</Text> : null}
          </View>
        ) : null}
        {step === 3 && draft.destination ? (
          <>
            <AdPreview destination={draft.destination} />
            <Text size={14} weight={600} lineHeight={16.8} style={styles.section}>Pay with</Text>
            <CreateAdPaymentPicker choices={choices} selected={paymentMethod} onSelect={setChosenPaymentMethod} />
            <Text size={12} lineHeight={16} color={colors.textMuted}>Ads are reviewed before they run, usually within a day. If an ad isn't approved, what you paid stays in your ad balance.</Text>
          </>
        ) : null}
        <AdsManagerBanner />
      </ScrollView>
      <View style={styles.footer}>
        {submit.isError ? <Text size={12} color={colors.error} align="center" accessibilityLiveRegion="assertive">{boostErrorMessage(submit.error)}</Text> : null}
        {step < 3 ? (
          <Button title="Continue" disabled={!canContinue} onPress={() => setStep(step + 1)} />
        ) : (
          <Button
            title={paymentMethod === "free" ? "Submit for review · Free" : total ? `Submit for review · ${formatMoneyForDisplay(total)}` : "Submit for review"}
            disabled={!canContinue}
            loading={submit.isPending}
            onPress={() => submit.mutate()}
          />
        )}
      </View>
    </Screen>
  );
}

const useStyles = makeThemedStyles((colors) => StyleSheet.create({
  content: { paddingHorizontal: 16, paddingTop: 8, paddingBottom: 24, gap: 8 },
  section: { marginTop: 12 },
  notice: { backgroundColor: colors.surface, borderRadius: 12, padding: 12, gap: 4 },
  estimate: { backgroundColor: colors.surface, borderRadius: 12, padding: 16, gap: 4, marginTop: 12 },
  footer: { paddingHorizontal: 16, paddingTop: 8, paddingBottom: 24, gap: 8 },
}));
