"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useIsOnline } from "@nantty/web-kit";
import { useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import { payoutOnboardingService } from "@/services/payoutOnboarding.service";
import { readErrorMessageForDisplay, StudioRequestError } from "@/services/clientApi.service";

import styles from "./payoutOnboarding.module.css";

const consentKey = ["payout-onboarding", "bvn-consent"] as const;

function isSafeRedirect(value: string): boolean {
  if (value.startsWith("/") && !value.startsWith("//") && !value.includes("\\")) return true;
  try {
    const url = new URL(value);
    return url.protocol === "https:" && !url.username && !url.password;
  } catch {
    return false;
  }
}

export function BvnConsentNotice() {
  const isOnline = useIsOnline();
  const queryClient = useQueryClient();
  const startingRef = useRef(false);
  const [isStarting, setIsStarting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const consent = useQuery({ queryKey: consentKey, queryFn: payoutOnboardingService.fetchBvnConsent, refetchInterval: (query) => (query.state.data?.status === "pending" && isOnline ? 5_000 : false) });
  const status = consent.data?.status;
  if (!status) return null;
  if (status === "verified") return <p className={`${styles.notice} ${styles.noticeSuccess}`}>Your bank confirmed your BVN. Your wallet account is set up in your name.</p>;

  async function start() {
    if (startingRef.current) return;
    startingRef.current = true;
    setIsStarting(true);
    setError(null);
    try {
      const started = await payoutOnboardingService.startBvnConsent(`${window.location.origin}/earnings?bvnConsent=returned`);
      if (started.consentUrl) {
        if (!isSafeRedirect(started.consentUrl)) throw new Error("Unexpected consent page. Contact support.");
        window.location.assign(started.consentUrl);
        return;
      }
      await queryClient.invalidateQueries({ queryKey: consentKey });
    } catch (failure) {
      setError(readErrorMessageForDisplay(failure));
    }
    startingRef.current = false;
    setIsStarting(false);
  }

  return (
    <div className={styles.stack}>
      <p className={styles.notice}>
        {status === "pending" ? (isOnline ? "Waiting for your bank to confirm your BVN. This updates on its own." : "You're offline. We'll check again when you're back online.") : status === "failed" ? "We couldn't confirm your BVN. Check that your payout name matches your bank, then try again." : status === "manual_review" ? "We're reviewing your details. We'll tell you when it's done." : "Nigerian payouts need your consent to check your BVN with your bank. We never see your bank login."}
      </p>
      {error ? <p className={`${styles.notice} ${styles.noticeError}`}>{error}</p> : null}
      {status !== "manual_review" ? <div className={styles.actions}><Button busy={isStarting} onClick={() => void start()}>{status === "pending" ? "Open consent again" : "Give consent"}</Button></div> : null}
    </div>
  );
}

export function WalletAccountSummary() {
  const [copied, setCopied] = useState(false);
  const wallet = useQuery({ queryKey: ["payments", "wallet", "me"], queryFn: payoutOnboardingService.fetchMyWalletAccount, retry: false });
  const notReady = wallet.error instanceof StudioRequestError && wallet.error.code === "WALLET_NOT_READY";
  const level = useQuery({ queryKey: ["payments", "verification", "me"], queryFn: payoutOnboardingService.fetchMyVerificationLevel, enabled: notReady, retry: false });
  if (wallet.isLoading) return null;
  if (notReady) {
    if (level.data && level.data.country !== "NG") return <p className={styles.notice}>Outside Nigeria fans and buyers pay you directly at checkout; there&apos;s no stored balance. Payouts go to your verified bank or mobile-money account.</p>;
    return <p className={styles.notice}>Finish verification to get your own wallet account number. Nothing you have earned is lost while you verify.</p>;
  }
  if (!wallet.data) return wallet.isError ? <p className={`${styles.notice} ${styles.noticeError}`}>{readErrorMessageForDisplay(wallet.error)}</p> : null;
  const account = wallet.data.wallet;
  const copy = () => void navigator.clipboard.writeText(account.accountNumber).then(() => setCopied(true), () => setCopied(false));
  return (
    <div className={styles.stack}>
      <p className={styles.notice}>
        Your wallet account: <strong>{account.bankName}</strong> · <strong>{account.accountNumber || "being set up"}</strong> · {account.accountName}. Earnings and deposits arrive in this account, held in your name by our licensed payment partner{account.provider === "flutterwave" ? ", Flutterwave" : ""}.
      </p>
      {account.status !== "active" ? <p className={`${styles.notice} ${styles.noticeError}`}>Your wallet is on hold while we check it. Contact support if this lasts.</p> : null}
      {account.accountNumber ? <div className={styles.actions}><Button size="sm" variant="secondary" onClick={copy}>{copied ? "Copied" : "Copy account number"}</Button></div> : null}
    </div>
  );
}
