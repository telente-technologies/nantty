"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useState, type FormEvent } from "react";

import { AppIcon } from "@/components/ui/appIcon";
import { Button } from "@/components/ui/button";
import { TextField } from "@/components/ui/field";
import { showToast } from "@/components/ui/toast";
import { WebappRequestError, sendRequestToWebappServer } from "@/services/clientApi.service";
import type { User } from "@/types";
import { readSafeRelativeRedirectPath } from "@/utils/safeRedirectPath.util";

import { SocialSignInButtons } from "../socialSignIn";
import styles from "../authForm.module.css";

function LoginForm() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [formError, setFormError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const canSubmit = identifier.trim().length > 0 && password.length > 0;

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFormError(null);
    if (!canSubmit) return;
    setBusy(true);
    try {
      const session = await sendRequestToWebappServer<{ user: User; notice?: string | null }>("/auth/login", { method: "POST", body: { identifier: identifier.trim(), password } });
      if (session.notice) showToast({ text: session.notice });
      router.push(readSafeRelativeRedirectPath(searchParams.get("next"), "/"));
      router.refresh();
    } catch (error) {
      setFormError(error instanceof WebappRequestError ? error.message : "Couldn't log in. Check your connection and try again.");
      setBusy(false);
    }
  }

  return (
    <form className={styles.form} onSubmit={handleSubmit} noValidate>
      <div className={styles.topBar}>
        <Link href="/welcome" className={styles.backButton} aria-label="Go back">
          <AppIcon name="arrowLeft24" size={24} />
        </Link>
      </div>

      {formError ? (
        <p className={styles.formError} role="alert">
          {formError}
        </p>
      ) : null}

      <div className={styles.fieldGroup}>
        <TextField
          label="Email"
          name="identifier"
          autoComplete="username"
          inputMode="email"
          placeholder="Enter your email"
          value={identifier}
          onChange={(event) => setIdentifier(event.target.value)}
          required
        />

        <TextField
          label="Password"
          name="password"
          type="password"
          autoComplete="current-password"
          placeholder="Enter password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          required
        />
      </div>

      <Link href="/forgot-password" className={styles.forgotLink}>
        Forgot password?
      </Link>

      <Button type="submit" fullWidth size="lg" busy={busy} disabled={!canSubmit}>
        Log in
      </Button>

      <div className={styles.socialStack}>
        <SocialSignInButtons redirectTo={readSafeRelativeRedirectPath(searchParams.get("next"), "/")} />
      </div>

      <p className={styles.switchPrompt}>
        Don’t have an account?{" "}
        <Link href="/signup" className={styles.linkStrong}>
          Sign up
        </Link>
      </p>
    </form>
  );
}

export default function LoginPage() {
  return (
    <Suspense>
      <LoginForm />
    </Suspense>
  );
}
