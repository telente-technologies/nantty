"use client";

import Link from "next/link";
import { useState } from "react";

import { Dialog } from "@/components/ui/dialog";
import { WebappRequestError } from "@/services/clientApi.service";
import { submitHumanVerificationToken } from "@/services/humanVerification.service";

import { useHumanVerificationStore } from "./humanVerification.store";
import { TurnstileWidget } from "./turnstileWidget";
import styles from "./humanVerificationDialog.module.css";

const siteKey = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY ?? "";

export function HumanVerificationDialog() {
  const { isOpen, reason, finishHumanVerification } = useHumanVerificationStore();
  const [attempt, setAttempt] = useState(0);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isChecking, setIsChecking] = useState(false);

  async function verify(token: string) {
    setIsChecking(true);
    setErrorMessage(null);
    try {
      await submitHumanVerificationToken(token);
      finishHumanVerification(true);
    } catch (error) {
      setErrorMessage(error instanceof WebappRequestError ? error.message : "We couldn't confirm that. Try again.");
      if (error instanceof WebappRequestError && error.code === "ACCOUNT_SUSPENDED_SECURITY") finishHumanVerification(false);
      else setAttempt((current) => current + 1);
    } finally {
      setIsChecking(false);
    }
  }

  const description = reason === "suspected_bot"
    ? "Your account needs a quick human check before this action."
    : "We noticed unusual activity on your account. Confirm you're a person to keep going.";

  return (
    <Dialog isOpen={isOpen} onClose={() => finishHumanVerification(false)} title="Quick security check" description={description} layout="sheet" intent="security">
      <div className={styles.body}>
        {errorMessage ? <p className={styles.error} role="alert">{errorMessage}</p> : null}
        {siteKey === "" ? <p className={styles.error} role="alert">Security checks are not set up on this site yet.</p> : null}
        {isOpen && siteKey !== "" ? <TurnstileWidget key={attempt} siteKey={siteKey} action={reason || "security_check"} onToken={(token) => void verify(token)} onError={() => setErrorMessage("The check didn't load. Check your connection and try again.")} /> : null}
        {isChecking ? <p className={styles.status} aria-live="polite">Checking…</p> : null}
        <p className={styles.privacy}>
          Protected by Cloudflare Turnstile. <Link href="/help/account-and-login/security-checks">Why am I seeing this?</Link>
        </p>
      </div>
    </Dialog>
  );
}
