"use client";

import { useState, type FormEvent } from "react";

import { Button } from "@/components/ui/button";
import { Callout } from "@/components/ui/feedback";
import { TextField } from "@/components/ui/formFields";
import { readErrorMessageForDisplay, sendRequestToDashboardServer } from "@/services/clientApi.service";

export function LoginForm({ nextPath }: { readonly nextPath: string | null }) {
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [isPasswordVisible, setIsPasswordVisible] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function submitSignInForm(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (identifier.trim().length < 3 || password.length === 0) {
      setErrorMessage("Enter your email or phone number and your password.");
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
    <form onSubmit={submitSignInForm} noValidate style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      {errorMessage ? <Callout tone="error">{errorMessage}</Callout> : null}
      <TextField label="Email or phone number" name="identifier" autoComplete="username" value={identifier} onChange={(event) => setIdentifier(event.target.value)} maxLength={254} required />
      <TextField label="Password" name="password" type={isPasswordVisible ? "text" : "password"} autoComplete="current-password" value={password} onChange={(event) => setPassword(event.target.value)} maxLength={128} required />
      <label style={{ display: "flex", gap: 8, alignItems: "center", color: "var(--ink-muted)", fontSize: 13 }}>
        <input type="checkbox" checked={isPasswordVisible} onChange={(event) => setIsPasswordVisible(event.target.checked)} /> Show password
      </label>
      <Button type="submit" variant="primary" size="large" isBusy={isSubmitting} fullWidth>
        Sign in
      </Button>
    </form>
  );
}
