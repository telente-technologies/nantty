"use client";

import { useSearchParams } from "next/navigation";
import { useState, type FormEvent } from "react";

import { Button } from "@/components/ui/button";
import { InlineNotice } from "@/components/ui/feedback";
import { TextField } from "@/components/ui/formFields";
import { readNanttyMainSiteUrl } from "@/constants/contact.constant";
import { accountsApi } from "@/services/accountsApi.service";
import { readErrorMessageForDisplay } from "@/services/adsApiClient.service";

import styles from "./loginForm.module.css";

export function LoginForm() {
  const searchParams = useSearchParams();
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function signInAndContinue(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (identifier.trim().length < 3 || password.length === 0) {
      setErrorMessage("Enter your email or username and your password.");
      return;
    }
    setIsSubmitting(true);
    setErrorMessage(null);
    try {
      const result = await accountsApi.signInWithPassword(identifier.trim(), password, searchParams.get("next"));
      window.location.assign(result.redirectTo);
    } catch (error) {
      setErrorMessage(readErrorMessageForDisplay(error));
      setIsSubmitting(false);
    }
  }

  return (
    <form className={styles.form} onSubmit={signInAndContinue} noValidate>
      <h1 className={styles.title}>Sign in to Ads Manager</h1>
      <p className={styles.lead}>Use the email or username and password from your Nantty app. Your store, posts, clips and followers are already here.</p>
      {errorMessage ? <InlineNotice tone="error">{errorMessage}</InlineNotice> : null}
      <TextField label="Email or username" value={identifier} onValueChange={setIdentifier} autoComplete="username" inputMode="email" autoFocus required />
      <TextField label="Password" type="password" value={password} onValueChange={setPassword} autoComplete="current-password" required />
      <Button type="submit" variant="primary" isLoading={isSubmitting} className={styles.submit}>
        Sign in
      </Button>
      <p className={styles.footnote}>Forgot your password? Reset it in the Nantty app under Settings → Security.</p>
      <p className={styles.getTheApp}>
        New to Nantty? <a href={readNanttyMainSiteUrl()}>Get the app</a>
      </p>
    </form>
  );
}
