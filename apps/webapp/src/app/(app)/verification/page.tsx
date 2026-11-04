"use client";

import Link from "next/link";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { ErrorState } from "@/components/ui/feedback";
import { GoldForBusinessesCard } from "@/components/verification/goldForBusinessesCard";
import { ListRowsSkeleton } from "@/components/ui/pageSkeletons";
import { showToast } from "@/components/ui/toast";
import { readErrorMessageForDisplay } from "@/services/clientApi.service";
import { verificationShopService } from "@/services/verification.service";
import { formatMoneyForDisplay } from "@/utils/formatMoney.util";

import styles from "./page.module.css";

export default function VerificationHubPage() {
  const queryClient = useQueryClient();
  const plans = useQuery({ queryKey: ["verification", "plans"], queryFn: () => verificationShopService.listVerificationPlans() });
  const mine = useQuery({ queryKey: ["verification", "me"], queryFn: () => verificationShopService.fetchMyVerification() });
  const [error, setError] = useState<string | null>(null);
  const cancel = useMutation({
    mutationFn: () => verificationShopService.cancelVerificationSubscription(),
    onSuccess: (updated) => {
      queryClient.setQueryData(["verification", "me"], updated);
      showToast({ text: "Subscription cancelled" });
    },
    onError: (mutationError) => setError(readErrorMessageForDisplay(mutationError)),
  });
  if (plans.isLoading || mine.isLoading) return <ListRowsSkeleton label="Loading verification" rows={5} />;
  if (plans.isError || mine.isError) return <ErrorState description="We couldn't load verification details." error={plans.error ?? mine.error} onRetry={() => { void plans.refetch(); void mine.refetch(); }} />;
  const current = mine.data?.current;
  const subscription = mine.data?.subscription;
  const application = mine.data?.application;
  return (
    <div className={styles.page}>
      <h1 className={styles.title}>Verification</h1>
      {current ? (
        <div className={styles.card}>
          <span className={styles.pill}>{current.status} · {current.color}</span>
          <span className={styles.rowMeta}>Badge {current.badgeVisible ? "visible" : "hidden"} · Tier {current.tier}</span>
        </div>
      ) : (
        <p className={styles.note}>Get a checkmark badge for your profile. Complete identity evidence and any eligible subscription checkout through the secure identity verification flow.</p>
      )}
      {subscription ? (
        <div className={styles.card}>
          <span className={styles.rowTitle}>Subscription · {subscription.status}</span>
          {subscription.renewsAt ? <span className={styles.rowMeta}>Renews {new Date(subscription.renewsAt).toLocaleDateString()}</span> : null}
          <button type="button" className={styles.linkButton} disabled={cancel.isPending} onClick={() => cancel.mutate()}>Cancel subscription</button>
        </div>
      ) : null}
      {application ? (
        <p className={styles.note}>Application {application.status}{application.rejectionReason ? ` — ${application.rejectionReason}` : ""}</p>
      ) : null}
      <section className={styles.section} aria-label="Plans">
        <h2 className={styles.sectionTitle}>Plans</h2>
        <ul className={styles.list}>
          {(plans.data ?? []).map((plan) => (
            <li key={plan.id} className={styles.row}>
              <span className={styles.rowMain}>
                <span className={styles.rowTitle}>{plan.color} · {plan.tier}</span>
                <span className={styles.rowMeta}>{plan.perks.map((perk) => perk.title).join(" · ")}</span>
              </span>
              <span className={styles.amount}>{formatMoneyForDisplay(plan.price)} / {plan.interval}</span>
            </li>
          ))}
        </ul>
      </section>
      <section className={styles.form} aria-label="Start identity verification">
        <p className={styles.note}>Identity is reviewed separately from payment. The secure identity flow collects real evidence, checks eligibility, and presents checkout only when available.</p>
        {error ? <p className={styles.error} role="alert">{error}</p> : null}
        <Link className={styles.primary} href="/settings/verification">Continue to identity verification</Link>
      </section>
      <GoldForBusinessesCard />
      <div className={styles.links}>
        <Link className={styles.linkButton} href="/settings/verification">Identity verification hub</Link>
      </div>
    </div>
  );
}
