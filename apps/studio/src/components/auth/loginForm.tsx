"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useState, type FormEvent } from "react";

import { AppIcon } from "@/components/ui/appIcon";
import { Button } from "@/components/ui/button";
import { TextField } from "@/components/ui/field";
import { StudioRequestError, sendRequestToStudioServer } from "@/services/clientApi.service";
import { signInWithSocialProvider, type SocialSignInProvider } from "@/services/socialSignIn.service";
import type { User } from "@/types";
import { readSafeRelativeRedirectPath } from "@/utils/safeRedirectPath.util";

import styles from "./loginForm.module.css";

export function LoginForm() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [formError, setFormError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [signingInWith, setSigningInWith] = useState<SocialSignInProvider | null>(null);
  const [busy, setBusy] = useState(false);

  const canSubmit = identifier.trim().length > 0 && password.length > 0;
  const socialBusy = signingInWith !== null;

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFormError(null);
    if (!canSubmit) return;
    setBusy(true);
    try {
      await sendRequestToStudioServer<{ user: User }>("/auth/login", { method: "POST", body: { identifier: identifier.trim(), password } });
      router.push(readSafeRelativeRedirectPath(searchParams.get("next"), "/home"));
      router.refresh();
    } catch (error) {
      setFormError(error instanceof StudioRequestError ? error.message : "Couldn't log in. Check your connection and try again.");
      setBusy(false);
    }
  }

  async function handleSocialSignIn(provider: SocialSignInProvider) {
    if (socialBusy) return;
    setFormError(null);
    setNotice(null);
    setSigningInWith(provider);
    try {
      await signInWithSocialProvider(provider);
      router.push(readSafeRelativeRedirectPath(searchParams.get("next"), "/home"));
      router.refresh();
    } catch (error) {
      setNotice(error instanceof StudioRequestError ? error.message : "Sign-in failed");
      setSigningInWith(null);
    }
  }

  return (
    <form className={styles.form} onSubmit={handleSubmit} noValidate>
      <div className={styles.heading}>
        <h1 className={styles.title}>Log in</h1>
        <p className={styles.subtitle}>Go live, connect OBS and manage your overlays.</p>
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

      <Button type="submit" fullWidth size="lg" busy={busy} disabled={!canSubmit || socialBusy}>
        Log in
      </Button>

      <div className={styles.divider} role="presentation">
        <span className={styles.dividerText}>or</span>
      </div>

      <div className={styles.socialStack}>
        <Button
          variant="secondary"
          fullWidth
          size="lg"
          leadingIcon={<AppIcon name="apple24" size={24} />}
          busy={signingInWith === "apple"}
          disabled={socialBusy}
          onClick={() => handleSocialSignIn("apple")}
        >
          Continue with Apple
        </Button>
        <Button
          variant="secondary"
          fullWidth
          size="lg"
          leadingIcon={<AppIcon name="google24" size={24} />}
          busy={signingInWith === "google"}
          disabled={socialBusy}
          onClick={() => handleSocialSignIn("google")}
        >
          Continue with Google
        </Button>
        {notice ? (
          <p className={styles.formError} role="alert">
            {notice}
          </p>
        ) : null}
      </div>

      <p className={styles.footNote}>
        New here? Create your account on the{" "}
        <Link href="https://nantty.com/welcome" className={styles.linkStrong}>
          Nantty app
        </Link>
        .
      </p>
    </form>
  );
}
