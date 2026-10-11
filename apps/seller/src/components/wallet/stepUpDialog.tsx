"use client";

import { useCallback, useRef, useState, type ReactNode } from "react";

import { useSellerSession } from "@/components/session/sellerSessionProvider";
import { Button } from "@/components/ui/button";
import { TextField } from "@/components/ui/formFields";
import { ModalDialog } from "@/components/ui/modalDialog";
import { readErrorMessageForDisplay } from "@/services/clientApi.service";
import { forgetStepUpToken, isStepUpRequiredError, readCachedStepUpToken, stepUpService } from "@/services/stepUp.service";

export class StepUpCancelledError extends Error {
  public constructor() {
    super("Confirm it's you to continue.");
    this.name = "StepUpCancelledError";
  }
}

type Pending = { readonly resolve: (token: string) => void; readonly reject: (error: Error) => void };

export function useStepUpPrompt(): { readonly withStepUp: <Result>(action: (token: string) => Promise<Result>) => Promise<Result>; readonly stepUpDialog: ReactNode } {
  const viewerEmail = useSellerSession().sessionView?.user.email ?? "";
  const pending = useRef<Pending | null>(null);
  const [isOpen, setIsOpen] = useState(false);
  const [mode, setMode] = useState<"password" | "email">("password");
  const [password, setPassword] = useState("");
  const [code, setCode] = useState("");
  const [codeSent, setCodeSent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const askForToken = useCallback(() => {
    const cached = readCachedStepUpToken();
    if (cached) return Promise.resolve(cached);
    setPassword("");
    setCode("");
    setCodeSent(false);
    setError(null);
    setIsOpen(true);
    return new Promise<string>((resolve, reject) => {
      pending.current = { resolve, reject };
    });
  }, []);

  const withStepUp = useCallback(async <Result,>(action: (token: string) => Promise<Result>) => {
    try {
      return await action(await askForToken());
    } catch (failure) {
      if (!isStepUpRequiredError(failure)) throw failure;
      forgetStepUpToken();
      return action(await askForToken());
    }
  }, [askForToken]);

  const close = () => {
    setIsOpen(false);
    pending.current?.reject(new StepUpCancelledError());
    pending.current = null;
  };

  const run = async (work: () => Promise<string | void>) => {
    setBusy(true);
    setError(null);
    try {
      const token = await work();
      if (typeof token === "string") {
        setIsOpen(false);
        pending.current?.resolve(token);
        pending.current = null;
      }
    } catch (failure) {
      setError(readErrorMessageForDisplay(failure));
    } finally {
      setBusy(false);
    }
  };

  const submit = () => {
    if (mode === "password") return run(() => stepUpService.grantWithPassword(password));
    if (!codeSent) return run(async () => { await stepUpService.sendEmailCode(viewerEmail); setCodeSent(true); });
    return run(() => stepUpService.grantWithEmailCode(viewerEmail, code.trim()));
  };

  const stepUpDialog = (
    <ModalDialog intent="stepUp"
      isOpen={isOpen}
      onClose={close}
      width="small"
      title="Confirm it's you"
      description="We check again before money leaves your wallet or a payout account changes."
      footer={<Button isBusy={busy} disabled={busy} onClick={() => void submit()}>{mode === "email" && !codeSent ? "Email me a code" : "Confirm"}</Button>}
    >
      <form onSubmit={(event) => { event.preventDefault(); void submit(); }}>
        {mode === "password" ? (
          <TextField label="Password" type="password" autoComplete="current-password" value={password} onChange={(event) => setPassword(event.target.value)} errorMessage={error} />
        ) : codeSent ? (
          <TextField label={`Code sent to ${viewerEmail}`} inputMode="numeric" autoComplete="one-time-code" maxLength={6} value={code} onChange={(event) => setCode(event.target.value)} errorMessage={error} />
        ) : (
          <p>{error ?? `We'll email a 6-digit code to ${viewerEmail}.`}</p>
        )}
        {viewerEmail ? (
          <Button variant="ghost" onClick={() => { setError(null); setMode(mode === "password" ? "email" : "password"); }}>
            {mode === "password" ? "No password? Use an emailed code" : "Use my password instead"}
          </Button>
        ) : null}
      </form>
    </ModalDialog>
  );

  return { withStepUp, stepUpDialog };
}
