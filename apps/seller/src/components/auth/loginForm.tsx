"use client";

import Link from "next/link";
import { useState, type FormEvent } from "react";

import { Button } from "@/components/ui/button";
import { Callout } from "@/components/ui/feedback";
import { TextField } from "@/components/ui/formFields";
import { readErrorMessageForDisplay, sendRequestToDashboardServer } from "@/services/clientApi.service";

import styles from "./authForms.module.css";

export function LoginForm({ nextPath, initialIdentifier, getTheAppUrl }: { readonly nextPath: string | null; readonly initialIdentifier: string; readonly getTheAppUrl: string }) {
  const [identifier, setIdentifier] = useState(initialIdentifier);
  const [password, setPassword] = useState("");
  const [isPasswordVisible, setIsPasswordVisible] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function submitSignInForm(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (identifier.trim().length < 3 || password.length === 0) {
      setErrorMessage("Enter your email or username and your password.");
      return;
    }
    setIsSubmitting(true);
    setErrorMessage(null);
    try {
      const result = await sendRequestToDashboardServer<{ redirectTo: string }>("/bff/auth/login", { method: "POST", body: { identifier: identifier.trim(), password, next: nextPath } });
      window.location.assign(result.redirectTo);
    } catch (error) {
      setErrorMessage(readErrorMessageForDisplay(error));
      setIsSubmitting(false);
    }
  }

  return (
    <div className={styles.formStack}>
      <div>
        <h1 className={styles.title}>Sign in with your Nantty account</h1>
        <p className={styles.subtitle}>Use the same details you use in the Nantty app. There is no separate dashboard account.</p>
      </div>
      <form onSubmit={submitSignInForm} noValidate className={styles.formStack}>
        {errorMessage ? <Callout tone="error">{errorMessage}</Callout> : null}
        <TextField label="Email or username" name="identifier" autoComplete="username" value={identifier} onChange={(event) => setIdentifier(event.target.value)} maxLength={254} required autoFocus={!initialIdentifier} />
        <TextField label="Password" name="password" type={isPasswordVisible ? "text" : "password"} autoComplete="current-password" value={password} onChange={(event) => setPassword(event.target.value)} maxLength={128} required autoFocus={Boolean(initialIdentifier)} />
        <div className={styles.rowBetween}>
          <label className={styles.checkboxLabel}>
            <input type="checkbox" checked={isPasswordVisible} onChange={(event) => setIsPasswordVisible(event.target.checked)} /> Show password
          </label>
          <Link href="/forgot-password">Forgot password?</Link>
        </div>
        <Button type="submit" variant="primary" size="large" isBusy={isSubmitting} fullWidth>
          Sign in
        </Button>
      </form>
      <p className={styles.syncNote}>Your products, stock, orders, customers and wallet are the same here as in the app. Changes here show in the app straight away.</p>
      <p className={styles.footnote}>
        New to Nantty? <a href={getTheAppUrl}>Get the app</a> to create your account and verify your business.
      </p>
    </div>
  );
}
