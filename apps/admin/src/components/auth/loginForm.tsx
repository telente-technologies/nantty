"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";

import { Button } from "@/components/ui/button";
import { InlineError, NoticeBanner } from "@/components/ui/feedback";
import { TextField } from "@/components/ui/formFields";
import { readErrorMessageForDisplay, sendRequestToAdminConsoleServer } from "@/services/adminApiClient.service";

import styles from "./authForms.module.css";

export function LoginForm({ reasonMessage, nextPath, isMockBackend }: { readonly reasonMessage: string | null; readonly nextPath: string; readonly isMockBackend: boolean }) {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  async function submitCredentials(event: FormEvent) {
    event.preventDefault();
    setIsSubmitting(true);
    setErrorMessage(null);
    try {
      await sendRequestToAdminConsoleServer("/bff/auth/login", { method: "POST", body: { email, password, next: nextPath }, promptForStepUp: false });
      router.push("/login/mfa");
    } catch (error) {
      setErrorMessage(readErrorMessageForDisplay(error));
      setIsSubmitting(false);
    }
  }

  return (
    <form onSubmit={submitCredentials} className={styles.form}>
      {reasonMessage ? <NoticeBanner tone="info">{reasonMessage}</NoticeBanner> : null}
      <TextField label="Work email" type="email" autoComplete="username" value={email} onChange={(event) => setEmail(event.target.value)} required autoFocus />
      <TextField label="Password" type="password" autoComplete="current-password" value={password} onChange={(event) => setPassword(event.target.value)} required />
      {errorMessage ? <InlineError message={errorMessage} /> : null}
      <Button type="submit" variant="primary" isBusy={isSubmitting}>
        Continue
      </Button>
      {isMockBackend ? (
        <NoticeBanner tone="caution" title="Demo mode">
          Superadmin: tolu.adeyemi@example.com · Admin: chidi.okafor@example.com · Needs MFA setup: bola.hassan@example.com. Password <code>nantty-admin-demo</code>, authenticator code <code>000000</code>. Never available outside demo mode.
        </NoticeBanner>
      ) : null}
    </form>
  );
}
