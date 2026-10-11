"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState, type FormEvent } from "react";

import { Button } from "@/components/ui/button";
import { ErrorState, Skeleton } from "@/components/ui/feedback";
import { MailIcon } from "@/components/ui/icons";
import { showToast } from "@/components/ui/toast";
import { readErrorMessageForDisplay } from "@/services/clientApi.service";
import { emailVerificationService } from "@/services/webActions.service";
import { readSafeRelativeRedirectPath } from "@/utils/safeRedirectPath.util";

import styles from "./page.module.css";

function useResendCountdown() {
  const [secondsLeft, setSecondsLeft] = useState(0);
  useEffect(() => {
    if (secondsLeft <= 0) return;
    const timer = setTimeout(() => setSecondsLeft((seconds) => seconds - 1), 1_000);
    return () => clearTimeout(timer);
  }, [secondsLeft]);
  return { secondsLeft, startCountdown: setSecondsLeft };
}

function EmailVerification() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const nextPath = readSafeRelativeRedirectPath(useSearchParams().get("next"), "/settings");
  const [code, setCode] = useState("");
  const [hasSentCode, setHasSentCode] = useState(false);
  const { secondsLeft, startCountdown } = useResendCountdown();
  const statusQuery = useQuery({ queryKey: ["account", "email"], queryFn: emailVerificationService.fetchAccountEmailStatus, retry: false });
  const sendMutation = useMutation({
    mutationFn: emailVerificationService.sendVerificationCode,
    onSuccess: (result) => {
      setHasSentCode(true);
      startCountdown(result.resendAfterSeconds);
      showToast({ text: "Code sent. Check your inbox." });
    },
  });
  const confirmMutation = useMutation({
    mutationFn: () => emailVerificationService.confirmVerificationCode(code),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["account", "email"] });
      await queryClient.invalidateQueries({ queryKey: ["profile", "me"] });
      showToast({ text: "Email verified" });
      router.push(nextPath);
    },
  });

  if (statusQuery.isLoading) return <Skeleton height={320} />;
  if (statusQuery.isError || !statusQuery.data) return <ErrorState error={statusQuery.error} description="We couldn't load your account email." onRetry={() => void statusQuery.refetch()} />;
  const { email, emailVerified } = statusQuery.data;

  function submitCode(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (/^\d{6}$/.test(code)) confirmMutation.mutate();
  }

  return (
    <div className={styles.card}>
      <span className={styles.icon} aria-hidden="true">
        <MailIcon size={26} />
      </span>
      <h1 className={styles.title}>{emailVerified ? "Your email is verified" : "Verify your email"}</h1>
      <p className={styles.text}>
        {emailVerified
          ? `${email} is verified. Receipts and payment updates go there.`
          : `We'll send a 6-digit code to ${email ?? "your account email"}. Payments and receipts use this address, so checkout needs it verified.`}
      </p>
      {emailVerified ? (
        <Button onClick={() => router.push(nextPath)}>Continue</Button>
      ) : (
        <>
          {hasSentCode ? (
            <form className={styles.form} onSubmit={submitCode}>
              <label htmlFor="email-code" className={styles.label}>
                Verification code
              </label>
              <input
                id="email-code"
                className={styles.codeInput}
                inputMode="numeric"
                autoComplete="one-time-code"
                pattern="\d{6}"
                maxLength={6}
                value={code}
                autoFocus
                onChange={(event) => setCode(event.target.value.replace(/\D/g, ""))}
              />
              <Button type="submit" fullWidth size="lg" disabled={code.length !== 6} busy={confirmMutation.isPending}>
                Verify email
              </Button>
            </form>
          ) : null}
          <Button variant={hasSentCode ? "ghost" : "primary"} size={hasSentCode ? "md" : "lg"} onClick={() => sendMutation.mutate()} disabled={secondsLeft > 0 || !email} busy={sendMutation.isPending}>
            {hasSentCode ? (secondsLeft > 0 ? `Resend code in ${secondsLeft}s` : "Resend code") : "Send code"}
          </Button>
          {sendMutation.isError || confirmMutation.isError ? (
            <p className={styles.error} role="alert">
              {readErrorMessageForDisplay(confirmMutation.error ?? sendMutation.error)}
            </p>
          ) : null}
        </>
      )}
    </div>
  );
}

export default function VerifyEmailPage() {
  return (
    <Suspense fallback={null}>
      <EmailVerification />
    </Suspense>
  );
}
