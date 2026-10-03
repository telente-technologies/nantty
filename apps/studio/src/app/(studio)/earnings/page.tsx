"use client";

import { useQuery } from "@tanstack/react-query";
import { Suspense } from "react";

import { PayoutOnboardingPanel } from "@/components/payouts/payoutOnboardingPanel";
import { usePayoutStateQuery } from "@/components/payouts/payoutStateQuery.hook";
import { payoutOnboardingService } from "@/services/payoutOnboarding.service";
import { formatMoneyForDisplay } from "@/utils/formatMoney.util";

import styles from "./page.module.css";

export default function EarningsPage() {
  const fees = useQuery({ queryKey: ["payout-fees"], queryFn: payoutOnboardingService.fetchPayoutFees });
  const { data: state } = usePayoutStateQuery();
  return (
    <div className={styles.page}>
      <header>
        <h1 className={styles.title}>Earnings and payouts</h1>
        <p className={styles.subtitle}>Gifts and subscriptions are recorded as you earn them. Set up payouts once to withdraw to your bank.</p>
      </header>
      {state && state.status !== "verified" && state.pendingWithdrawable ? (
        <p className={styles.notice}>Verify your ID to withdraw {formatMoneyForDisplay(state.pendingWithdrawable)}. Everything else in Studio keeps working.</p>
      ) : null}
      <Suspense fallback={null}>
        <PayoutOnboardingPanel />
      </Suspense>
      {fees.data ? (
        <section className={styles.card} aria-label="Payout fee">
          <strong>Payout fee</strong>
          <p className={styles.muted}>{formatMoneyForDisplay(fees.data.fee)} flat per withdrawal, added on top of the amount. {fees.data.arrivalEstimate}</p>
          <p className={styles.muted}>{fees.data.firstPayoutNote}</p>
        </section>
      ) : null}
    </div>
  );
}
