"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";

import { Button } from "@/components/ui/button";
import { TextField } from "@/components/ui/field";
import { authService } from "@/services/auth.service";
import { readErrorMessageForDisplay } from "@/services/clientApi.service";

import styles from "../authForm.module.css";

export default function ForgotPasswordPage() {
  const router = useRouter();
  const [destination, setDestination] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const trimmed = destination.trim();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(trimmed)) {
      setError("Enter the email linked to your account.");
      return;
    }
    setError(null);
    setBusy(true);
    try {
      await authService.sendOneTimeCode(trimmed, "reset");
      router.push(`/reset-password?destination=${encodeURIComponent(trimmed)}`);
    } catch (caught) {
      setError(readErrorMessageForDisplay(caught));
      setBusy(false);
    }
  }

  return (
    <form className={styles.form} onSubmit={handleSubmit} noValidate>
      <header className={styles.header}>
        <h1 className={styles.title}>Reset your password</h1>
        <p className={styles.subtitle}>Tell us where to send a reset code.</p>
      </header>

      {error ? (
        <p className={styles.formError} role="alert">
          {error}
        </p>
      ) : null}

      <TextField
        label="Email"
        name="destination"
        type="email"
        inputMode="email"
        autoComplete="email"
        placeholder="Enter your email"
        value={destination}
        onChange={(event) => setDestination(event.target.value)}
      />

      <Button type="submit" fullWidth size="lg" busy={busy}>
        Send code
      </Button>

      <p className={styles.switchPrompt}>
        Remembered it?{" "}
        <Link href="/login" className={styles.linkStrong}>
          Back to sign in
        </Link>
      </p>
    </form>
  );
}
