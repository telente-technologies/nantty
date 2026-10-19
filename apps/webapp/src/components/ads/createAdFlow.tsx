"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { useCountryRequiredRetry } from "@/components/commerce/countryRequiredDialog";
import { Button } from "@/components/ui/button";
import { ErrorState } from "@/components/ui/feedback";
import { ListRowsSkeleton } from "@/components/ui/pageSkeletons";
import { useStepUpPrompt } from "@/components/wallet/stepUpDialog";
import { adsHubService } from "@/services/adsHub.service";
import { boostsService } from "@/services/boosts.service";
import { createIdempotencyKey, readErrorMessageForDisplay, WebappRequestError } from "@/services/clientApi.service";
import { walletsService } from "@/services/wallets.service";
import { useLocaleStore } from "@/store/locale.store";
import type { BoostDestinationType, BoostEstimateRequest, BoostPaymentMethod } from "@/types/boost.type";
import {
  audienceIssue, budgetFloorIssue, createIdempotencyKeyHolder, describePaymentOption, estimateRequestFromDraft, firstSelectablePaymentMethod, goalsForDestination, readPaymentOptions, type AdDraft,
} from "@/utils/adsHub.util";
import { boostErrorMessageForCode } from "@/utils/boostPayment.util";
import { formatMoneyForDisplay } from "@/utils/formatMoney.util";
import { openHostedCheckout } from "@/utils/hostedCheckout.util";

import { AdPaymentPicker } from "./adPaymentPicker";
import { AdPreview } from "./adPreview";
import { AdsManagerOptionalLink } from "./adsHubParts";
import { CreateAdAudienceStep } from "./createAdAudienceStep";
import { CreateAdBudgetStep } from "./createAdBudgetStep";
import { CreateAdDestinationStep } from "./createAdDestinationStep";
import styles from "./adsHub.module.css";

const STEP_TITLES = ["What to promote", "Goal", "Audience", "Budget", "Review and pay"] as const;

function useDebouncedValue<Value>(value: Value, delayMs: number): Value {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delayMs);
    return () => clearTimeout(timer);
  }, [value, delayMs]);
  return debounced;
}

export function CreateAdFlow({ initialDraft, isResubmission }: { readonly initialDraft: AdDraft; readonly isResubmission: boolean }) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const defaultCountryCode = useLocaleStore((state) => state.countryCode ?? state.deviceRegionCode ?? "");
  const [step, setStep] = useState(initialDraft.destination ? 1 : 0);
  const [draft, setDraft] = useState<AdDraft>(initialDraft);
  const [destinationType, setDestinationType] = useState<BoostDestinationType>(initialDraft.destination?.type ?? "post");
  const [chosenMethod, setChosenMethod] = useState<BoostPaymentMethod | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const keyHolder = useRef(createIdempotencyKeyHolder(() => createIdempotencyKey("ad")));
  const { retry: countryRetry, dialog: countryDialog } = useCountryRequiredRetry();
  const { withStepUpIfRequired, stepUpDialog } = useStepUpPrompt();

  const options = useQuery({ queryKey: ["boosts", "options"], queryFn: () => boostsService.fetchBoostOptions() });
  const paymentOptions = options.data ? readPaymentOptions(options.data) : [];
  const earningsOffered = paymentOptions.some((option) => option.method === "balance" && option.available);
  const wallet = useQuery({ queryKey: ["wallet", "summary"], queryFn: () => walletsService.fetchMyWalletSummary(), enabled: earningsOffered, retry: false });

  const draftWithDefaults: AdDraft = useMemo(() => {
    if (!options.data || draft.dailyBudget || draft.totalBudget) return draft;
    const suggestedDaily = options.data.suggestedDailyBudgets[1] ?? options.data.suggestedDailyBudgets[0] ?? options.data.minimumDailyBudget;
    return { ...draft, dailyBudget: suggestedDaily };
  }, [draft, options.data]);
  const request = estimateRequestFromDraft(draftWithDefaults);
  const floorIssue = options.data ? budgetFloorIssue(draftWithDefaults, options.data.minimumDailyBudget, (money) => formatMoneyForDisplay(money)) : null;
  const estimateRequest = useDebouncedValue<BoostEstimateRequest | null>(floorIssue ? null : request, 400);
  const estimate = useQuery({ queryKey: ["boosts", "estimate", estimateRequest], queryFn: () => boostsService.estimateBoostReach(estimateRequest!), enabled: Boolean(estimateRequest), retry: false });
  const estimateIsCurrent = Boolean(estimate.data) && JSON.stringify(estimateRequest) === JSON.stringify(request);
  const total = estimateIsCurrent ? estimate.data!.totalCost : null;

  const paymentStates = paymentOptions.map((option) => describePaymentOption(option, {
    total, adFundsSpendable: options.data?.adBalance?.spendable ?? null, earningsAvailable: wallet.data?.available ?? null, freeBoostMaxTotal: options.data?.freeBoost?.maxTotal ?? null,
  }, (money) => formatMoneyForDisplay(money)));
  const paymentMethod = firstSelectablePaymentMethod(paymentStates, chosenMethod);
  const reasonCodes = Object.fromEntries(paymentOptions.map((option) => [option.method, option.reasonCode]));

  const create = useMutation({
    mutationFn: () => {
      const body = { ...request!, paymentMethod: paymentMethod! };
      const key = keyHolder.current.keyFor(body);
      return paymentMethod === "balance" ? withStepUpIfRequired((stepUpToken) => adsHubService.createBoost(body, key, stepUpToken)) : adsHubService.createBoost(body, key);
    },
    onSuccess: (created) => {
      void queryClient.invalidateQueries({ queryKey: ["ads"] });
      void queryClient.invalidateQueries({ queryKey: ["boosts", "options"] });
      if (paymentMethod === "balance") void queryClient.invalidateQueries({ queryKey: ["wallet"] });
      if (created.checkoutUrl && openHostedCheckout({ checkoutUrl: created.checkoutUrl, reference: created.boost.id }) === "redirected") return;
      router.push(`/ads/${encodeURIComponent(created.boost.id)}`);
    },
    onError: (error) => {
      const code = error instanceof WebappRequestError ? error.code : null;
      if (countryRetry.handle(code, () => create.mutate())) return;
      setSubmitError(boostErrorMessageForCode(code) ?? readErrorMessageForDisplay(error));
      if (code === "FREE_BOOST_USED" || code === "FREE_BOOST_NOT_AVAILABLE" || code === "INSUFFICIENT_AD_BALANCE" || code === "VERIFICATION_REQUIRED") {
        setChosenMethod(null);
        void queryClient.invalidateQueries({ queryKey: ["boosts", "options"] });
      }
    },
  });

  if (options.isLoading) return <ListRowsSkeleton label="Loading ad options" rows={5} />;
  if (options.isError || !options.data) return <ErrorState description="We couldn't load ad options." error={options.error} onRetry={() => void options.refetch()} />;

  const goals = draftWithDefaults.destination ? goalsForDestination(options.data, draftWithDefaults.destination.type) : [];
  const stepIsComplete = [
    Boolean(draftWithDefaults.destination && draftWithDefaults.destination.type === destinationType),
    Boolean(draftWithDefaults.goal && goals.some((goal) => goal.id === draftWithDefaults.goal)),
    !audienceIssue(draftWithDefaults.audience),
    !floorIssue && Boolean(request) && estimateIsCurrent,
    Boolean(paymentMethod && total),
  ];
  const estimateError = estimate.isError ? boostErrorMessageForCode(estimate.error instanceof WebappRequestError ? estimate.error.code : null) ?? readErrorMessageForDisplay(estimate.error) : null;
  const update = (next: AdDraft) => {
    setSubmitError(null);
    setDraft(next);
  };

  return (
    <div className={styles.page}>
      {countryDialog}
      {stepUpDialog}
      <div className={styles.headerRow}>
        <h1 className={styles.title}>{isResubmission ? "Edit and resubmit" : "Create ad"}</h1>
        <Link className={styles.quietLink} href="/ads">Cancel</Link>
      </div>
      <ol className={styles.steps} aria-label="Steps">
        {STEP_TITLES.map((title, index) => (
          <li key={title} className={[styles.step, index === step ? styles.stepCurrent : ""].filter(Boolean).join(" ")} aria-current={index === step ? "step" : undefined}>{index + 1}. {title}</li>
        ))}
      </ol>
      {isResubmission && step === 0 ? <p className={styles.note}>Your rejected ad&apos;s settings are filled in. Change what the review flagged, then submit again. Money from a rejected ad stays in your ad balance.</p> : null}

      {step === 0 ? (
        <CreateAdDestinationStep
          destinationType={destinationType}
          destination={draftWithDefaults.destination}
          onDestinationTypeChange={(type) => {
            setDestinationType(type);
            if (draftWithDefaults.destination?.type !== type) update({ ...draftWithDefaults, destination: null, goal: null });
          }}
          onDestinationChange={(destination) => update({ ...draftWithDefaults, destination, goal: goalsForDestination(options.data, destination.type)[0]?.id ?? null })}
        />
      ) : null}

      {step === 1 ? (
        <section className={styles.section} aria-label="Goal">
          <h2 className={styles.sectionTitle}>What do you want more of?</h2>
          <div className={styles.options} role="radiogroup" aria-label="Goal">
            {goals.map((goal) => (
              <button key={goal.id} type="button" role="radio" aria-checked={draftWithDefaults.goal === goal.id} className={[styles.option, draftWithDefaults.goal === goal.id ? styles.optionSelected : ""].filter(Boolean).join(" ")} onClick={() => update({ ...draftWithDefaults, goal: goal.id })}>
                <span className={styles.optionTitle}>{goal.label}</span>
                {goal.hint ? <span className={styles.optionHint}>{goal.hint}</span> : null}
              </button>
            ))}
          </div>
        </section>
      ) : null}

      {step === 2 ? <CreateAdAudienceStep audience={draftWithDefaults.audience} defaultCountryCode={defaultCountryCode} estimate={estimateIsCurrent ? estimate.data : undefined} estimateLoading={estimate.isFetching} onChange={(audience) => update({ ...draftWithDefaults, audience })} /> : null}

      {step === 3 ? <CreateAdBudgetStep draft={draftWithDefaults} options={options.data} estimate={estimateIsCurrent ? estimate.data : undefined} estimateError={estimateError} onChange={update} /> : null}

      {step === 4 && draftWithDefaults.destination ? (
        <>
          <AdPreview destination={draftWithDefaults.destination} />
          <div className={styles.card}>
            <span className={styles.label}>Total</span>
            <span className={styles.metricValue}>{total ? formatMoneyForDisplay(total) : "—"}</span>
            {estimateIsCurrent && estimate.data ? <span className={styles.rowMeta}>{draftWithDefaults.durationDays} {draftWithDefaults.durationDays === 1 ? "day" : "days"} · {estimate.data.estimatedReachMin.toLocaleString()}–{estimate.data.estimatedReachMax.toLocaleString()} people</span> : null}
          </div>
          <AdPaymentPicker states={paymentStates} reasonCodes={reasonCodes} selected={paymentMethod} onSelect={(method) => { setSubmitError(null); setChosenMethod(method); }} />
          {paymentStates.every((state) => !state.selectable) ? <p className={styles.error} role="alert">No way to pay is available for this ad right now.</p> : null}
        </>
      ) : null}

      {submitError ? <p className={styles.error} role="alert">{submitError}</p> : null}
      <div className={styles.footer}>
        {step > 0 ? <button type="button" className={styles.linkButton} onClick={() => setStep(step - 1)}>Back</button> : <span />}
        {step < STEP_TITLES.length - 1 ? (
          <Button disabled={!stepIsComplete[step]} onClick={() => setStep(step + 1)}>Next</Button>
        ) : (
          <Button disabled={!stepIsComplete.every(Boolean)} busy={create.isPending} onClick={() => { setSubmitError(null); create.mutate(); }}>
            {paymentMethod === "card" ? "Pay and submit for review" : "Submit for review"}
          </Button>
        )}
      </div>
      <AdsManagerOptionalLink />
    </div>
  );
}
