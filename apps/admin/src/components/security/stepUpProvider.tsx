"use client";

import { useCallback, useEffect, useRef, useState, type FormEvent, type ReactNode } from "react";

import { Button } from "@/components/ui/button";
import { InlineError } from "@/components/ui/feedback";
import { TextField } from "@/components/ui/formFields";
import { ModalDialog } from "@/components/ui/modalDialog";
import { readErrorMessageForDisplay, registerStepUpPrompt, sendRequestToAdminConsoleServer } from "@/services/adminApiClient.service";

import styles from "./stepUpProvider.module.css";

export function StepUpProvider({ children }: { readonly children: ReactNode }) {
  const [isOpen, setIsOpen] = useState(false);
  const [code, setCode] = useState("");
  const [isVerifying, setIsVerifying] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const resolverRef = useRef<((confirmed: boolean) => void) | null>(null);

  const openStepUpPrompt = useCallback(
    () =>
      new Promise<boolean>((resolve) => {
        resolverRef.current?.(false);
        resolverRef.current = resolve;
        setCode("");
        setErrorMessage(null);
        setIsOpen(true);
      }),
    [],
  );

  useEffect(() => {
    registerStepUpPrompt(openStepUpPrompt);
    return () => registerStepUpPrompt(null);
  }, [openStepUpPrompt]);

  function finish(confirmed: boolean) {
    setIsOpen(false);
    resolverRef.current?.(confirmed);
    resolverRef.current = null;
  }

  async function verifyCode(event: FormEvent) {
    event.preventDefault();
    setIsVerifying(true);
    setErrorMessage(null);
    try {
      await sendRequestToAdminConsoleServer("/bff/auth/step-up", { method: "POST", body: { method: "totp", code }, promptForStepUp: false });
      finish(true);
    } catch (error) {
      setErrorMessage(readErrorMessageForDisplay(error));
    } finally {
      setIsVerifying(false);
    }
  }

  return (
    <>
      {children}
      <ModalDialog isOpen={isOpen} title="Confirm it's you" description="This action is sensitive. Enter the current code from your authenticator app. You won't be asked again for 5 minutes." onClose={() => finish(false)} width="narrow" tone="secure">
        <form className={styles.form} onSubmit={verifyCode}>
          <TextField label="Authenticator code" value={code} onChange={(event) => setCode(event.target.value.replace(/\D/g, "").slice(0, 6))} inputMode="numeric" autoComplete="one-time-code" pattern="\d{6}" placeholder="123456" autoFocus className={styles.codeField} />
          {errorMessage ? <InlineError message={errorMessage} /> : null}
          <div className={styles.actions}>
            <Button variant="ghost" onClick={() => finish(false)}>
              Cancel
            </Button>
            <Button type="submit" variant="primary" iconName="shield24" isBusy={isVerifying} disabled={code.length !== 6}>
              Confirm
            </Button>
          </div>
        </form>
      </ModalDialog>
    </>
  );
}
