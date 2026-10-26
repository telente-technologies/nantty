"use client";

import { useCallback, useRef, useState, type ReactNode } from "react";

import { Dialog } from "@nantty/web-kit";

import { Button } from "@/components/ui/button";
import { TextField } from "@/components/ui/field";
import { readErrorMessageForDisplay } from "@/services/clientApi.service";
import { forgetStepUpToken, isStepUpRequiredError, readCachedStepUpToken, stepUpService } from "@/services/stepUp.service";
import { useAuthStore } from "@/store/auth.store";

export class StepUpCancelledError extends Error {
  public constructor() {
    super("Confirm it's you to continue.");
    this.name = "StepUpCancelledError";
  }
}

type Pending = { readonly resolve: (token: string) => void; readonly reject: (error: Error) => void };

export function useStepUpPrompt(): { readonly withStepUp: <Result>(action: (token: string) => Promise<Result>) => Promise<Result>; readonly stepUpDialog: ReactNode } {
  const viewerEmail = useAuthStore((state) => state.user?.email ?? "");
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
    } catch (error) {
      if (!isStepUpRequiredError(error)) throw error;
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

  const stepUpDialog = (
    <Dialog isOpen={isOpen} onClose={close} title="Confirm it's you" description="We check again before a payout account changes." intent="stepUp" busy={busy}>
      <form
        onSubmit={(event) => {
          event.preventDefault();
          if (mode === "password") void run(() => stepUpService.grantWithPassword(password));
          else if (!codeSent) void run(async () => { await stepUpService.sendEmailCode(viewerEmail); setCodeSent(true); });
          else void run(() => stepUpService.grantWithEmailCode(viewerEmail, code.trim()));
        }}
      >
        {mode === "password" ? (
          <TextField label="Password" type="password" autoComplete="current-password" value={password} onChange={(event) => setPassword(event.target.value)} required error={error} />
        ) : codeSent ? (
          <TextField label={`Code sent to ${viewerEmail}`} inputMode="numeric" autoComplete="one-time-code" maxLength={6} value={code} onChange={(event) => setCode(event.target.value)} required error={error} />
        ) : (
          <p>{error ?? `We'll email a 6-digit code to ${viewerEmail}.`}</p>
        )}
        <Button type="submit" busy={busy}>{mode === "email" && !codeSent ? "Email me a code" : "Confirm"}</Button>
        {viewerEmail ? (
          <Button type="button" variant="ghost" onClick={() => { setError(null); setMode(mode === "password" ? "email" : "password"); }}>
            {mode === "password" ? "No password? Use an emailed code" : "Use my password instead"}
          </Button>
        ) : null}
        <Button type="button" variant="quiet" onClick={close}>Cancel</Button>
      </form>
    </Dialog>
  );

  return { withStepUp, stepUpDialog };
}
