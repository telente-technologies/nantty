"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useState, type FormEvent } from "react";

import { Button } from "@/components/ui/button";
import { TextField } from "@/components/ui/field";
import { authService } from "@/services/auth.service";
import { readErrorMessageForDisplay, sendRequestToWebappServer } from "@/services/clientApi.service";

import styles from "../authForm.module.css";

function ResetPasswordForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const destination = searchParams.get("destination") ?? "";
  const [code, setCode] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!destination) {
      setError("Start again from the forgot password page.");
      return;
    }
    if (!/^\d{6}$/.test(code) || password.length < 8) {
      setError("Enter the 6-digit code and a password of at least 8 characters.");
      return;
    }
    setError(null);
    setBusy(true);
    try {
      const verified = await authService.verifyOneTimeCode(destination, code, "reset");
      await sendRequestToWebappServer<void>("/api/v1/auth/password/reset", { method: "POST", body: { otpToken: verified.otpToken, password } });
      setNotice("Password updated. Sign in with your new password.");
      window.setTimeout(() => router.push("/login"), 900);
    } catch (caught) {
      setError(readErrorMessageForDisplay(caught));
      setBusy(false);
    }
  }

  return (
    <form className={styles.form} onSubmit={handleSubmit} noValidate>
      <header className={styles.header}>
        <h1 className={styles.title}>Choose a new password</h1>
        <p className={styles.subtitle}>Enter the code sent to {destination || "your account"} and pick a new password.</p>
      </header>

      {error ? (
        <p className={styles.formError} role="alert">
          {error}
        </p>
      ) : null}

      {notice ? (
        <p className={styles.inlineNote} role="status">
          {notice}
        </p>
      ) : null}

      <input
        className={styles.otpInput}
        inputMode="numeric"
        autoComplete="one-time-code"
        pattern="\d{6}"
        maxLength={6}
        aria-label="6-digit reset code"
        value={code}
        onChange={(event) => setCode(event.target.value.replace(/\D/g, "").slice(0, 6))}
      />

      <TextField
        label="New password"
        name="password"
        type="password"
        autoComplete="new-password"
        hint="At least 8 characters."
        minLength={8}
        value={password}
        onChange={(event) => setPassword(event.target.value)}
      />

      <Button type="submit" fullWidth size="lg" busy={busy}>
        Update password
      </Button>

      <p className={styles.switchPrompt}>
        Need a new code?{" "}
        <Link href="/forgot-password" className={styles.linkStrong}>
          Send it again
        </Link>
      </p>
    </form>
  );
}

export default function ResetPasswordPage() {
  return (
    <Suspense>
      <ResetPasswordForm />
    </Suspense>
  );
}
