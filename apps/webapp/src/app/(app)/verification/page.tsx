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
import type { ID } from "@/types";
import { formatMoneyForDisplay } from "@/utils/formatMoney.util";

import styles from "./page.module.css";

export default function VerificationHubPage() {
  const queryClient = useQueryClient();
  const plans = useQuery({ queryKey: ["verification", "plans"], queryFn: () => verificationShopService.listVerificationPlans() });
  const mine = useQuery({ queryKey: ["verification", "me"], queryFn: () => verificationShopService.fetchMyVerification() });
  const [planId, setPlanId] = useState<ID | "">("");
  const [legalName, setLegalName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const cancel = useMutation({
    mutationFn: () => verificationShopService.cancelVerificationSubscription(),
    onSuccess: (updated) => {
      queryClient.setQueryData(["verification", "me"], updated);
      showToast({ text: "Subscription cancelled" });
    },
    onError: (mutationError) => setError(readErrorMessageForDisplay(mutationError)),
  });
  const apply = useMutation({
    mutationFn: () => {
      const plan = plans.data?.find((entry) => entry.id === planId);
      if (!plan) throw new Error("Pick a plan first.");
      if (!legalName.trim()) throw new Error("Enter your legal name.");
      return verificationShopService.submitVerificationApplication({
        kind: "blue",
        planId: plan.id,
        legalName: legalName.trim(),
        identityDocument: { documentType: "nin_slip", documentNumber: "web", documentPhotoUrl: "web" },
        selfiePhotoUrl: "web",
      });
    },
    onSuccess: (checkout) => {
      window.location.href = checkout.checkoutUrl;
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
        <p className={styles.note}>Get a checkmark badge for your profile. Business verification with documents happens in the mobile app.</p>
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
              <span className={styles.amount}>{formatMoneyForDisplay(plan.price)}</span>
              <button type="button" className={[styles.chip, planId === plan.id ? styles.chipActive : ""].filter(Boolean).join(" ")} aria-pressed={planId === plan.id} onClick={() => setPlanId(plan.id)}>Pick</button>
            </li>
          ))}
        </ul>
      </section>
      <form
        className={styles.form}
        onSubmit={(event) => {
          event.preventDefault();
          apply.mutate();
        }}
      >
        <label className={styles.field}>Legal name
          <input className={styles.input} value={legalName} onChange={(event) => setLegalName(event.target.value)} required />
        </label>
        <p className={styles.note}>Identity documents and selfies are captured in the mobile app or identity check. Continue to checkout to start.</p>
        {error ? <p className={styles.error} role="alert">{error}</p> : null}
        <button type="submit" className={styles.primary} disabled={apply.isPending || !planId}>{apply.isPending ? "Starting…" : "Continue to checkout"}</button>
      </form>
      <GoldForBusinessesCard />
      <div className={styles.links}>
        <Link className={styles.linkButton} href="/settings/verification">Identity verification hub</Link>
      </div>
    </div>
  );
}
