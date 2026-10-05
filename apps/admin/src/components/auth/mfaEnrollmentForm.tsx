"use client";

import { useEffect, useState, type FormEvent } from "react";

import { Button } from "@/components/ui/button";
import { ErrorBlock, InlineError, LoadingBlock, NoticeBanner } from "@/components/ui/feedback";
import { CheckboxField, TextField } from "@/components/ui/formFields";
import { readErrorMessageForDisplay, sendRequestToAdminConsoleServer } from "@/services/adminApiClient.service";

import styles from "./authForms.module.css";

interface EnrollmentSecret {
  readonly secret: string;
  readonly otpauthUri: string;
}

export function MfaEnrollmentForm() {
  const [secret, setSecret] = useState<EnrollmentSecret | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [code, setCode] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [completion, setCompletion] = useState<{ redirectTo: string; recoveryCodes: readonly string[] } | null>(null);
  const [hasSavedCodes, setHasSavedCodes] = useState(false);

  const [loadAttempt, setLoadAttempt] = useState(0);

  useEffect(() => {
    sendRequestToAdminConsoleServer<EnrollmentSecret>("/bff/auth/mfa/enrollment", { method: "POST", promptForStepUp: false })
      .then(setSecret)
      .catch((error: unknown) => setLoadError(readErrorMessageForDisplay(error)));
  }, [loadAttempt]);

  async function confirmCode(event: FormEvent) {
    event.preventDefault();
    setIsSubmitting(true);
    setErrorMessage(null);
    try {
      const result = await sendRequestToAdminConsoleServer<{ redirectTo: string; recoveryCodes: readonly string[] | null }>("/bff/auth/mfa/verify", { method: "POST", body: { method: "totp", code }, promptForStepUp: false });
      setCompletion({ redirectTo: result.redirectTo, recoveryCodes: result.recoveryCodes ?? [] });
    } catch (error) {
      setErrorMessage(readErrorMessageForDisplay(error));
    } finally {
      setIsSubmitting(false);
    }
  }

  if (loadError) {
    return (
      <ErrorBlock
        message={loadError}
        onRetry={() => {
          setLoadError(null);
          setLoadAttempt((attempt) => attempt + 1);
        }}
      />
    );
  }
  if (!secret) return <LoadingBlock label="Preparing your authenticator key" lines={3} />;
  if (completion) {
    return (
      <div className={styles.form}>
        <NoticeBanner tone="success" title="Authenticator is set up">
          Save these recovery codes somewhere safe, like your password manager. Each works once if you lose your phone. They won't be shown again.
        </NoticeBanner>
        <ul className={styles.recoveryCodes} aria-label="Recovery codes">
          {completion.recoveryCodes.map((recoveryCode) => (
            <li key={recoveryCode}>{recoveryCode}</li>
          ))}
        </ul>
        <CheckboxField label="I saved my recovery codes" checked={hasSavedCodes} onChange={(event) => setHasSavedCodes(event.target.checked)} />
        <Button variant="primary" disabled={!hasSavedCodes} onClick={() => window.location.assign(completion.redirectTo)}>
          Continue to the console
        </Button>
      </div>
    );
  }

  const groupedSecret = secret.secret.match(/.{1,4}/g)?.join(" ") ?? secret.secret;
  return (
    <form className={styles.form} onSubmit={confirmCode}>
      <ol className={styles.steps}>
        <li>Open Google Authenticator, 1Password, Authy or another authenticator app.</li>
        <li>Add an account with the setup key below (time-based, 6 digits).</li>
        <li>Enter the 6-digit code the app shows.</li>
      </ol>
      <div className={styles.secretBox}>
        <span className={styles.secret} aria-label="Setup key">{groupedSecret}</span>
        <Button size="small" iconName="copy16" onClick={() => void navigator.clipboard?.writeText(secret.otpauthUri)}>
          Copy setup link
        </Button>
      </div>
      <TextField label="6-digit code" value={code} onChange={(event) => setCode(event.target.value.replace(/\D/g, "").slice(0, 6))} inputMode="numeric" autoComplete="one-time-code" placeholder="123456" className={styles.codeField} />
      {errorMessage ? <InlineError message={errorMessage} /> : null}
      <Button type="submit" variant="primary" isBusy={isSubmitting} disabled={code.length !== 6}>
        Turn on two-step verification
      </Button>
    </form>
  );
}
