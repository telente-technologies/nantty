"use client";

import Link from "next/link";
import { useState, type FormEvent } from "react";

import { Button } from "@/components/ui/button";
import { Callout } from "@/components/ui/feedback";
import { TextField } from "@/components/ui/formFields";
import { readErrorMessageForDisplay, sendRequestToDashboardServer } from "@/services/clientApi.service";

import styles from "./authForms.module.css";

type ResetStep = "destination" | "code" | "password" | "done";

function describePasswordProblem(password: string): string | null {
  if (password.length < 8) return "Use at least 8 characters.";
  if (!/[A-Za-z]/.test(password) || !/\d/.test(password)) return "Mix letters and numbers.";
  return null;
}

export function PasswordResetForm({ demoCode }: { readonly demoCode: string | null }) {
  const [step, setStep] = useState<ResetStep>("destination");
  const [destination, setDestination] = useState("");
  const [code, setCode] = useState("");
  const [password, setPassword] = useState("");
  const [passwordAgain, setPasswordAgain] = useState("");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isBusy, setIsBusy] = useState(false);

  async function runStep(action: () => Promise<void>) {
    setIsBusy(true);
    setErrorMessage(null);
    try {
      await action();
    } catch (error) {
      setErrorMessage(readErrorMessageForDisplay(error));
    } finally {
      setIsBusy(false);
    }
  }

  function submitCurrentStep(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (step === "destination") {
      if (destination.trim().length < 3) return setErrorMessage("Enter the email address on your Zudomart account.");
      void runStep(async () => {
        await sendRequestToDashboardServer("/bff/auth/password-reset/code", { method: "POST", body: { destination: destination.trim() } });
        setStep("code");
      });
    } else if (step === "code") {
      if (!/^\d{6}$/.test(code.trim())) return setErrorMessage("Enter the 6-digit code.");
      void runStep(async () => {
        await sendRequestToDashboardServer("/bff/auth/password-reset/verify", { method: "POST", body: { destination: destination.trim(), code: code.trim() } });
        setStep("password");
      });
    } else if (step === "password") {
      const problem = describePasswordProblem(password) ?? (password !== passwordAgain ? "The two passwords do not match." : null);
      if (problem) return setErrorMessage(problem);
      void runStep(async () => {
        await sendRequestToDashboardServer("/bff/auth/password-reset/complete", { method: "POST", body: { password } });
        setStep("done");
      });
    }
  }

  return (
    <div className={styles.formStack}>
      <div>
        <h1 className={styles.title}>{step === "done" ? "Password changed" : "Reset your password"}</h1>
        <p className={styles.subtitle}>
          {step === "destination" && "This resets the password for your Zudomart account everywhere: the app and this dashboard."}
          {step === "code" && `If ${destination.trim()} belongs to a Zudomart account, we have sent it a 6-digit code. It expires in 5 minutes.`}
          {step === "password" && "Choose a new password. Other devices signed in to your account will be signed out."}
          {step === "done" && "Sign in with your new password, here and in the Zudomart app."}
        </p>
      </div>
      {errorMessage ? <Callout tone="error">{errorMessage}</Callout> : null}
      {step === "code" && demoCode ? <Callout tone="info">Demo mode: use code {demoCode}.</Callout> : null}
      {step === "done" ? (
        <Link href="/login" className={styles.primaryLink}>
          Go to sign in
        </Link>
      ) : (
        <form onSubmit={submitCurrentStep} noValidate className={styles.formStack}>
          {step === "destination" ? <TextField label="Email address" type="email" autoComplete="email" value={destination} onChange={(event) => setDestination(event.target.value)} maxLength={254} autoFocus /> : null}
          {step === "code" ? <TextField label="6-digit code" inputMode="numeric" autoComplete="one-time-code" value={code} onChange={(event) => setCode(event.target.value.replace(/\D/g, "").slice(0, 6))} autoFocus /> : null}
          {step === "password" ? (
            <>
              <TextField label="New password" type="password" autoComplete="new-password" value={password} onChange={(event) => setPassword(event.target.value)} maxLength={128} hint="At least 8 characters with letters and numbers." autoFocus />
              <TextField label="Type it again" type="password" autoComplete="new-password" value={passwordAgain} onChange={(event) => setPasswordAgain(event.target.value)} maxLength={128} />
            </>
          ) : null}
          <Button type="submit" variant="primary" size="large" fullWidth isBusy={isBusy}>
            {step === "destination" ? "Send me a code" : step === "code" ? "Check code" : "Change password"}
          </Button>
          {step === "code" ? (
            <button type="button" className={styles.textButton} onClick={() => { setStep("destination"); setCode(""); }}>
              Use a different email
            </button>
          ) : null}
        </form>
      )}
      <p className={styles.footnote}>
        Remembered it? <Link href="/login">Back to sign in</Link>
      </p>
    </div>
  );
}
