"use client";

import Link from "next/link";

import { formatMoneyForDisplay } from "@/utils/formatMoney.util";

import styles from "./payoutOnboarding.module.css";
import { usePayoutStateQuery } from "./payoutStateQuery.hook";

export function PayoutSetupBanner() {
  const { data: state } = usePayoutStateQuery();
  if (!state || state.status === "verified") return null;
  const isReady = state.accountStatus === "documentsRequired" && state.status === "in_progress";
  const title = state.status === "pending_review" ? "Payouts are in review" : state.status === "action_needed" ? "Action needed on your payouts" : isReady ? (state.pendingWithdrawable && state.pendingWithdrawable.amountMinor > 0 ? `Verify your ID to withdraw ${formatMoneyForDisplay(state.pendingWithdrawable)}` : "Verify your ID to withdraw") : state.completedSteps.length === 0 ? "Set up payouts to receive gift earnings" : "Finish payout setup";
  return (
    <div className={styles.banner}>
      <div className={styles.bannerText}>
        <strong>{title}</strong>
        <p className={styles.muted}>Gifts keep adding up while you set this up. Withdrawing needs it. It takes about 5 minutes and covers your seller earnings too.</p>
      </div>
      <Link href="/earnings" className={styles.bannerLink}>{state.status === "action_needed" ? "See what's needed" : "Continue"}</Link>
    </div>
  );
}
