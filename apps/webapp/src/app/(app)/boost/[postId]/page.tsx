"use client";

import { useParams, useRouter } from "next/navigation";
import { useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";

import { RetryButton } from "@/components/ui/controls";
import { ErrorState } from "@/components/ui/feedback";
import { ListRowsSkeleton } from "@/components/ui/pageSkeletons";
import { boostsService } from "@/services/boosts.service";
import { readErrorMessageForDisplay } from "@/services/clientApi.service";
import { walletsService } from "@/services/wallets.service";
import type { BoostAudience, BoostGoal } from "@/types/boost.type";
import { formatMoneyForDisplay } from "@/utils/formatMoney.util";

import styles from "../page.module.css";

const GOALS: readonly { readonly id: BoostGoal; readonly label: string }[] = [
  { id: "views", label: "More views" },
  { id: "profile_visits", label: "More profile visits" },
  { id: "messages", label: "More messages" },
];

export default function PromotePostPage() {
  const params = useParams<{ postId: string }>();
  const postId = params.postId;
  const router = useRouter();
  const options = useQuery({ queryKey: ["boosts", "options"], queryFn: () => boostsService.fetchBoostOptions() });
  const wallet = useQuery({ queryKey: ["wallet", "summary"], queryFn: () => walletsService.fetchMyWalletSummary() });
  const [goal, setGoal] = useState<BoostGoal>("views");
  const [budgetIndex, setBudgetIndex] = useState(1);
  const [durationDays, setDurationDays] = useState<number | null>(null);
  const [paymentMethod, setPaymentMethod] = useState<"wallet" | "card">("card");
  const [error, setError] = useState<string | null>(null);
  const budgets = options.data?.suggestedDailyBudgets ?? [];
  const dailyBudget = budgets[Math.min(budgetIndex, Math.max(budgets.length - 1, 0))] ?? null;
  const days = durationDays ?? options.data?.durationDayOptions[1] ?? null;
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
      if (created.checkoutUrl) {
        window.location.href = created.checkoutUrl;
        return;
      }
      router.push(`/boost/status/${created.boost.id}`);
    },
    onError: (mutationError) => setError(readErrorMessageForDisplay(mutationError)),
  });
  if (options.isLoading) return <ListRowsSkeleton label="Loading promotion options" rows={5} />;
  if (options.isError || !options.data) return <ErrorState description="We couldn't load promotion options." action={<RetryButton onRetry={() => options.refetch()} />} />;
  const walletCanPay = !!wallet.data && !!estimate.data && wallet.data.available.currency === estimate.data.totalCost.currency && wallet.data.available.amountMinor >= estimate.data.totalCost.amountMinor;
  return (
    <div className={styles.page}>
      <h1 className={styles.title}>Promote post</h1>
      <section className={styles.section} aria-label="Goal">
        <h2 className={styles.sectionTitle}>Goal</h2>
        <div className={styles.chips}>
          {GOALS.map((option) => (
            <button key={option.id} type="button" className={[styles.chip, goal === option.id ? styles.chipActive : ""].filter(Boolean).join(" ")} aria-pressed={goal === option.id} onClick={() => setGoal(option.id)}>{option.label}</button>
          ))}
        </div>
      </section>
      <section className={styles.section} aria-label="Daily budget">
        <h2 className={styles.sectionTitle}>Daily budget</h2>
        <div className={styles.chips}>
          {budgets.map((budget, index) => (
            <button key={`${budget.amountMinor}-${budget.currency}`} type="button" className={[styles.chip, index === budgetIndex ? styles.chipActive : ""].filter(Boolean).join(" ")} aria-pressed={index === budgetIndex} onClick={() => setBudgetIndex(index)}>{formatMoneyForDisplay(budget)}</button>
          ))}
        </div>
      </section>
      <section className={styles.section} aria-label="Duration">
        <h2 className={styles.sectionTitle}>Duration</h2>
        <div className={styles.chips}>
          {options.data.durationDayOptions.map((daysOption) => (
            <button key={daysOption} type="button" className={[styles.chip, (durationDays ?? options.data.durationDayOptions[1]) === daysOption ? styles.chipActive : ""].filter(Boolean).join(" ")} aria-pressed={(durationDays ?? options.data.durationDayOptions[1]) === daysOption} onClick={() => setDurationDays(daysOption)}>{daysOption} days</button>
          ))}
        </div>
      </section>
      {estimate.data ? (
        <div className={styles.card}>
          <span className={styles.rowTitle}>{estimate.data.estimatedResultsLabel}</span>
          <span className={styles.rowMeta}>Reach {estimate.data.estimatedReachMin.toLocaleString()}–{estimate.data.estimatedReachMax.toLocaleString()} · Total {formatMoneyForDisplay(estimate.data.totalCost)}</span>
        </div>
      ) : null}
      <section className={styles.section} aria-label="Payment method">
        <h2 className={styles.sectionTitle}>Pay with</h2>
        <div className={styles.chips}>
          <button type="button" className={[styles.chip, paymentMethod === "card" ? styles.chipActive : ""].filter(Boolean).join(" ")} aria-pressed={paymentMethod === "card"} onClick={() => setPaymentMethod("card")}>Card</button>
          <button type="button" className={[styles.chip, paymentMethod === "wallet" ? styles.chipActive : ""].filter(Boolean).join(" ")} aria-pressed={paymentMethod === "wallet"} disabled={!walletCanPay} onClick={() => setPaymentMethod("wallet")}>Wallet{walletCanPay ? "" : " (insufficient)"}</button>
        </div>
      </section>
      {error ? <p className={styles.error} role="alert">{error}</p> : null}
      <button type="button" className={styles.primary} disabled={!request || create.isPending} onClick={() => create.mutate()}>{create.isPending ? "Starting…" : "Start promotion"}</button>
    </div>
  );
}
