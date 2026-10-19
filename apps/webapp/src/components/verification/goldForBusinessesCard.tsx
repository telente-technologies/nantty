"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";

import { ErrorState, Skeleton } from "@/components/ui/feedback";
import { goldForBusinessesService } from "@/services/goldForBusinesses.service";
import { describeGoldTier, formatBasisPointsAsPercent, GOLD_FOR_BUSINESSES_TITLE } from "@/utils/goldForBusinessesQuote.util";

import styles from "./goldForBusinesses.module.css";
import { GoldForBusinessesManage } from "./goldForBusinessesManage";
import { GoldForBusinessesPurchase } from "./goldForBusinessesPurchase";

const goldForBusinessesQueryKey = ["subscriptions", "gold-for-businesses"] as const;

export function GoldForBusinessesCard() {
  const queryClient = useQueryClient();
  const state = useQuery({ queryKey: goldForBusinessesQueryKey, queryFn: goldForBusinessesService.fetchGoldForBusinesses, retry: false });
  const refresh = () => void queryClient.invalidateQueries({ queryKey: goldForBusinessesQueryKey });
  if (state.isPending) return <Skeleton height={160} />;
  if (state.isError) return <ErrorState description="We couldn't load Gold for your businesses." error={state.error} onRetry={() => void state.refetch()} />;
  const { premium, rules, businesses, subscription } = state.data;
  return (
    <section className={styles.card} aria-labelledby="gold-for-businesses-heading">
      <h2 id="gold-for-businesses-heading" className={styles.title}>{GOLD_FOR_BUSINESSES_TITLE}</h2>
      <p className={styles.note}>One Gold plan for up to {rules.maximumProfiles} of your businesses. Each business still needs its own business verification for its Gold checkmark.</p>
      <p className={styles.note}>{rules.tiers.map(describeGoldTier).join(" · ")}</p>
      {subscription ? (
        <GoldForBusinessesManage key={subscription.id} state={state.data} subscription={subscription} onChanged={refresh} />
      ) : !premium ? (
        <p className={styles.note}>Needs Blue Premium. Get Blue Premium to cover all your businesses with one Gold plan, up to {formatBasisPointsAsPercent(Math.max(0, ...rules.tiers.map((tier) => tier.discountBps)))} off.</p>
      ) : businesses.length === 0 ? (
        <p className={styles.note}>Add a Business page or Brand first. <Link href="/settings/profiles">Manage business profiles</Link></p>
      ) : (
        <GoldForBusinessesPurchase state={state.data} onActivated={refresh} />
      )}
    </section>
  );
}
