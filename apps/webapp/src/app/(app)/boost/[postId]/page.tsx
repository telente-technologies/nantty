"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { RetryButton } from "@/components/ui/controls";
import { ErrorState } from "@/components/ui/feedback";
import { ListRowsSkeleton } from "@/components/ui/pageSkeletons";
import { boostsService } from "@/services/boosts.service";
import { readErrorMessageForDisplay, WebappRequestError } from "@/services/clientApi.service";
import { walletsService } from "@/services/wallets.service";
import type { BoostAudience, BoostGoal, BoostPaymentMethod, FreeBoostAllowance } from "@/types/boost.type";
import type { Money } from "@/types/money.type";
import { boostErrorMessageForCode, boostTotalFor, fitsWithinMoney, pickFreeBoostSelection, readBoostPaymentMethods, readUsableFreeBoost } from "@/utils/boostPayment.util";
import { formatMoneyForDisplay } from "@/utils/formatMoney.util";
import { readVerificationLevel } from "@/utils/walletLines.util";

import styles from "../page.module.css";

const GOALS: readonly { readonly id: BoostGoal; readonly label: string }[] = [
  { id: "views", label: "More views" },
  { id: "profile_visits", label: "More profile visits" },
  { id: "messages", label: "More messages" },
];

const VERIFY_HREF = "/wallet/payouts#payout-accounts";
const chipClass = (active: boolean) => [styles.chip, active ? styles.chipActive : ""].filter(Boolean).join(" ");

export default function PromotePostPage() {
  const params = useParams<{ postId: string }>();
  const postId = params.postId;
  const router = useRouter();
  const queryClient = useQueryClient();
  const options = useQuery({ queryKey: ["boosts", "options"], queryFn: () => boostsService.fetchBoostOptions() });
  const wallet = useQuery({ queryKey: ["wallet", "summary"], queryFn: () => walletsService.fetchMyWalletSummary() });
  const [goal, setGoal] = useState<BoostGoal>("views");
  const [chosenBudgetIndex, setBudgetIndex] = useState<number | null>(null);
  const [durationDays, setDurationDays] = useState<number | null>(null);
  const [chosenMethod, setChosenMethod] = useState<BoostPaymentMethod | null>(null);
  const [error, setError] = useState<{ readonly text: string; readonly code: string | null } | null>(null);

  const budgets = options.data?.suggestedDailyBudgets ?? [];
  const dayOptions = options.data?.durationDayOptions ?? [];
  const methods = options.data ? readBoostPaymentMethods(options.data) : [];
  const usableFreeBoost = options.data ? readUsableFreeBoost(options.data) : null;
  const freeDefaultSelection = usableFreeBoost ? pickFreeBoostSelection(budgets, dayOptions, usableFreeBoost.maxTotal, dayOptions[1] ?? null) : null;
  const freeBoost = freeDefaultSelection ? usableFreeBoost : null;
  const paymentMethod: BoostPaymentMethod = chosenMethod && methods.includes(chosenMethod) && (chosenMethod !== "free" || freeBoost) ? chosenMethod : freeBoost ? "free" : "card";
  const freeDefault = paymentMethod === "free" ? freeDefaultSelection : null;
  const budgetIndex = chosenBudgetIndex ?? freeDefault?.budgetIndex ?? 1;
  const dailyBudget = budgets[Math.min(budgetIndex, Math.max(budgets.length - 1, 0))] ?? null;
  const days = durationDays ?? freeDefault?.days ?? dayOptions[1] ?? dayOptions[0] ?? null;
  const audience: BoostAudience = { mode: "automatic" };
  const request = dailyBudget && days ? { postId, goal, audience, dailyBudget, durationDays: days } : null;
  const estimate = useQuery({
    queryKey: ["boosts", "estimate", postId, goal, dailyBudget, days],
    queryFn: () => boostsService.estimateBoostReach(request!),
    enabled: !!request,
  });
  const create = useMutation({
    mutationFn: () => boostsService.createBoost({ ...request!, paymentMethod }),
    onSuccess: (created) => {
      if (paymentMethod === "balance") void queryClient.invalidateQueries({ queryKey: ["wallet"] });
      if (paymentMethod === "free") void queryClient.invalidateQueries({ queryKey: ["boosts", "options"] });
      if (paymentMethod === "card" && created.checkoutUrl) {
        window.location.href = created.checkoutUrl;
        return;
      }
      router.push(`/boost/status/${created.boost.id}`);
    },
    onError: (mutationError) => {
      const code = mutationError instanceof WebappRequestError ? mutationError.code : null;
      setError({ text: boostErrorMessageForCode(code) ?? readErrorMessageForDisplay(mutationError), code });
      if (code === "FREE_BOOST_USED" || code === "FREE_BOOST_NOT_AVAILABLE") {
        setChosenMethod("card");
        void queryClient.invalidateQueries({ queryKey: ["boosts", "options"] });
      }
      if (code === "INSUFFICIENT_FUNDS" || code === "VERIFICATION_REQUIRED") void queryClient.invalidateQueries({ queryKey: ["wallet"] });
    },
  });
  if (options.isLoading) return <ListRowsSkeleton label="Loading promotion options" rows={5} />;
  if (options.isError || !options.data) return <ErrorState description="We couldn't load promotion options." action={<RetryButton onRetry={() => options.refetch()} />} />;

  const total: Money | null = estimate.data?.totalCost ?? (dailyBudget && days ? boostTotalFor(dailyBudget, days) : null);
  const fitsFree = (budget: Money, forDays: number) => !!freeBoost && fitsWithinMoney(boostTotalFor(budget, forDays), freeBoost.maxTotal);
  const verified = readVerificationLevel(wallet.data) >= 1;
  const available = wallet.data?.available ?? null;
  const balanceCovers = !!available && !!total && fitsWithinMoney(total, available);
  const canPay = paymentMethod === "free" ? !!total && !!freeBoost && fitsWithinMoney(total, freeBoost.maxTotal) : paymentMethod === "balance" ? verified && balanceCovers : true;
  const choosePaid = (method: BoostPaymentMethod) => {
    setChosenMethod(method);
    setBudgetIndex(budgetIndex);
    if (days) setDurationDays(days);
  };
  const chooseFree = () => {
    setChosenMethod("free");
    const keepsSelection = !!dailyBudget && !!days && fitsFree(dailyBudget, days);
    const selection = keepsSelection || !freeBoost ? { budgetIndex, days } : pickFreeBoostSelection(budgets, dayOptions, freeBoost.maxTotal, days);
    if (selection) {
      setBudgetIndex(selection.budgetIndex);
      if (selection.days) setDurationDays(selection.days);
    }
  };
  const chooseDays = (option: number) => {
    setDurationDays(option);
    if (paymentMethod === "free" && freeBoost && dailyBudget && !fitsFree(dailyBudget, option)) {
      const selection = pickFreeBoostSelection(budgets, [option], freeBoost.maxTotal, option);
      if (selection) setBudgetIndex(selection.budgetIndex);
    }
  };
  const submitLabel = paymentMethod === "free" ? "Start free promotion" : paymentMethod === "balance" ? `Pay ${total ? formatMoneyForDisplay(total) : ""} from balance` : "Continue to Paystack";

  return (
    <div className={styles.page}>
      <h1 className={styles.title}>Promote post</h1>
      <FreeBoostNotice freeBoost={freeBoost} premiumUsed={!freeBoost && !!options.data.freeBoost?.premium && options.data.freeBoost.remainingThisMonth === 0} resetsAt={options.data.freeBoost?.resetsAt ?? null} />
      <section className={styles.section} aria-label="Goal">
        <h2 className={styles.sectionTitle}>Goal</h2>
        <div className={styles.chips}>
          {GOALS.map((option) => (
            <button key={option.id} type="button" className={chipClass(goal === option.id)} aria-pressed={goal === option.id} onClick={() => setGoal(option.id)}>{option.label}</button>
          ))}
        </div>
      </section>
      <section className={styles.section} aria-label="Daily budget">
        <h2 className={styles.sectionTitle}>Daily budget</h2>
        <div className={styles.chips}>
          {budgets.map((budget, index) => (
            <button key={`${budget.amountMinor}-${budget.currency}`} type="button" className={chipClass(index === budgetIndex)} aria-pressed={index === budgetIndex} disabled={paymentMethod === "free" && !!days && !fitsFree(budget, days)} onClick={() => setBudgetIndex(index)}>{formatMoneyForDisplay(budget)}</button>
          ))}
        </div>
      </section>
      <section className={styles.section} aria-label="Duration">
        <h2 className={styles.sectionTitle}>Duration</h2>
        <div className={styles.chips}>
          {dayOptions.map((daysOption) => (
            <button key={daysOption} type="button" className={chipClass(days === daysOption)} aria-pressed={days === daysOption} disabled={paymentMethod === "free" && !budgets.some((budget) => fitsFree(budget, daysOption))} onClick={() => chooseDays(daysOption)}>{daysOption} days</button>
          ))}
        </div>
      </section>
      {total ? (
        <div className={styles.card}>
          {estimate.data ? <span className={styles.rowTitle}>{estimate.data.estimatedResultsLabel}</span> : null}
          <span className={styles.rowMeta}>
            {estimate.data ? `Reach ${estimate.data.estimatedReachMin.toLocaleString()}–${estimate.data.estimatedReachMax.toLocaleString()} · ` : ""}
            Total {formatMoneyForDisplay(total)}{paymentMethod === "free" ? " · Free with Premium" : ""}
          </span>
        </div>
      ) : null}
      <section className={styles.section} aria-label="Payment method">
        <h2 className={styles.sectionTitle}>Pay with</h2>
        <div className={styles.chips}>
          {freeBoost ? <button type="button" className={chipClass(paymentMethod === "free")} aria-pressed={paymentMethod === "free"} onClick={chooseFree}>Free boost</button> : null}
          {methods.includes("card") ? <button type="button" className={chipClass(paymentMethod === "card")} aria-pressed={paymentMethod === "card"} onClick={() => choosePaid("card")}>Card or bank transfer (Paystack)</button> : null}
          {methods.includes("balance") ? (
            <button type="button" className={chipClass(paymentMethod === "balance")} aria-pressed={paymentMethod === "balance"} disabled={!verified || !balanceCovers} onClick={() => choosePaid("balance")}>Pay from my Zudomart balance</button>
          ) : null}
        </div>
        {methods.includes("balance") ? <BalanceNote loading={wallet.isLoading} failed={wallet.isError} verified={verified} available={available} covers={balanceCovers} /> : null}
      </section>
      {error ? (
        <p className={styles.error} role="alert">
          {error.text} {error.code === "VERIFICATION_REQUIRED" ? <Link href={VERIFY_HREF}>Verify now</Link> : null}
        </p>
      ) : null}
      <button type="button" className={styles.primary} disabled={!request || !canPay || create.isPending} onClick={() => { setError(null); create.mutate(); }}>{create.isPending ? "Starting…" : submitLabel}</button>
    </div>
  );
}

function FreeBoostNotice({ freeBoost, premiumUsed, resetsAt }: { readonly freeBoost: FreeBoostAllowance | null; readonly premiumUsed: boolean; readonly resetsAt: string | null }) {
  if (freeBoost) {
    return (
      <div className={styles.card}>
        <span className={styles.rowTitle}>Free boost available ({freeBoost.remainingThisMonth} this month)</span>
        <span className={styles.rowMeta}>Your Premium free boost covers up to {formatMoneyForDisplay(freeBoost.maxTotal)} in total.</span>
      </div>
    );
  }
  if (!premiumUsed) return null;
  const resetDate = resetsAt ? new Date(resetsAt) : null;
  return <p className={styles.note}>You&apos;ve used this month&apos;s free boost{resetDate && !Number.isNaN(resetDate.getTime()) ? `. Your next one arrives on ${resetDate.toLocaleDateString()}` : ""}.</p>;
}

function BalanceNote({ loading, failed, verified, available, covers }: { readonly loading: boolean; readonly failed: boolean; readonly verified: boolean; readonly available: Money | null; readonly covers: boolean }) {
  if (loading) return null;
  if (failed) return <p className={styles.note}>We couldn&apos;t load your balance, so paying from it isn&apos;t available right now.</p>;
  if (!verified) return <p className={styles.note}><Link href={VERIFY_HREF}>Verify to pay from balance</Link></p>;
  if (available && !covers) return <p className={styles.note}>Available to withdraw: {formatMoneyForDisplay(available)}. That&apos;s not enough for this promotion.</p>;
  return available ? <p className={styles.note}>Available to withdraw: {formatMoneyForDisplay(available)}</p> : null;
}
