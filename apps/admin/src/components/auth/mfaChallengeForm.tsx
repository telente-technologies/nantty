"use client";

import { useState, type FormEvent } from "react";

import { Button } from "@/components/ui/button";
import { InlineError } from "@/components/ui/feedback";
import { TextField } from "@/components/ui/formFields";
import { readErrorMessageForDisplay, sendRequestToAdminConsoleServer } from "@/services/adminApiClient.service";
import { isPasskeySupportedInThisBrowser, requestPasskeyAssertion, type PasskeyRequestOptionsJson } from "@/services/webauthnCeremony.service";

import styles from "./authForms.module.css";

export function MfaChallengeForm({ isPasskeyAvailable }: { readonly isPasskeyAvailable: boolean }) {
  const [code, setCode] = useState("");
  const [isRecoveryMode, setIsRecoveryMode] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  async function completeSignIn(body: Record<string, unknown>) {
    setIsSubmitting(true);
    setErrorMessage(null);
    try {
      const result = await sendRequestToAdminConsoleServer<{ redirectTo: string }>("/bff/auth/mfa/verify", { method: "POST", body, promptForStepUp: false });
      window.location.assign(result.redirectTo);
    } catch (error) {
      setErrorMessage(readErrorMessageForDisplay(error));
      setIsSubmitting(false);
    }
  }

  function submitCode(event: FormEvent) {
    event.preventDefault();
    void completeSignIn({ method: isRecoveryMode ? "recovery" : "totp", code });
  }

  async function signInWithPasskey() {
    setErrorMessage(null);
    try {
      const options = await sendRequestToAdminConsoleServer<PasskeyRequestOptionsJson>("/bff/auth/mfa/passkey-options", { method: "POST", promptForStepUp: false });
      const credential = await requestPasskeyAssertion(options);
      await completeSignIn({ method: "webauthn", credential });
    } catch (error) {
      setErrorMessage(error instanceof Error && !("code" in error) ? "The passkey prompt was closed or failed. Try again or use your code." : readErrorMessageForDisplay(error));
    }
  }

  return (
    <form className={styles.form} onSubmit={submitCode}>
      {isRecoveryMode ? (
        <TextField label="Recovery code" value={code} onChange={(event) => setCode(event.target.value.toUpperCase().slice(0, 20))} autoComplete="off" spellCheck={false} placeholder="ABCDE-12345" autoFocus />
      ) : (
        <TextField label="6-digit code" value={code} onChange={(event) => setCode(event.target.value.replace(/\D/g, "").slice(0, 6))} inputMode="numeric" autoComplete="one-time-code" placeholder="123456" className={styles.codeField} autoFocus />
      )}
      {errorMessage ? <InlineError message={errorMessage} /> : null}
      <Button type="submit" variant="primary" isBusy={isSubmitting} disabled={isRecoveryMode ? code.length < 8 : code.length !== 6}>
        Verify and sign in
      </Button>
      <button type="button" className={styles.linkButton} onClick={() => { setIsRecoveryMode(!isRecoveryMode); setCode(""); }}>
        {isRecoveryMode ? "Use my authenticator app instead" : "Lost your phone? Use a recovery code"}
      </button>
      {isPasskeyAvailable && isPasskeySupportedInThisBrowser() ? (
        <>
          <span className={styles.divider}>or</span>
          <Button onClick={signInWithPasskey} iconName="shield24">
            Use a passkey
          </Button>
        </>
      ) : null}
    </form>
  );
}
