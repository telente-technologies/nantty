import { useCallback, useRef, useState, type ReactNode } from "react";
import { View } from "react-native";

import { BottomSheet } from "@/components/ui/bottomSheet";
import { Button } from "@/components/ui/button";
import { TextField } from "@/components/ui/input";
import { Text } from "@/components/ui/text";
import { spacing } from "@/constants/spacing.constant";
import { forgetStepUpToken, isStepUpRequiredError, readCachedStepUpToken, stepUpService } from "@/services/money/stepUp.service";
import { useAuthStore } from "@/store/auth.store";

export class StepUpCancelledError extends Error {
  constructor() {
    super("Confirm it's you to continue.");
    this.name = "StepUpCancelledError";
  }
}

type Pending = { readonly resolve: (token: string) => void; readonly reject: (error: Error) => void };

export function useStepUpPrompt(): { readonly withStepUp: <Result>(action: (token: string) => Promise<Result>) => Promise<Result>; readonly stepUpSheet: ReactNode } {
  const viewerEmail = useAuthStore((state) => state.user?.email ?? "");
  const pending = useRef<Pending | null>(null);
  const [visible, setVisible] = useState(false);
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
    setVisible(true);
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
    setVisible(false);
    pending.current?.reject(new StepUpCancelledError());
    pending.current = null;
  };

  const run = async (work: () => Promise<string | void>) => {
    setBusy(true);
    setError(null);
    try {
      const token = await work();
      if (typeof token === "string") {
        setVisible(false);
        pending.current?.resolve(token);
        pending.current = null;
      }
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : "We couldn't confirm it's you. Try again.");
    } finally {
      setBusy(false);
    }
  };

  const submit = () => {
    if (mode === "password") return run(() => stepUpService.grantWithPassword(password));
    if (!codeSent) return run(async () => { await stepUpService.sendEmailCode(viewerEmail); setCodeSent(true); });
    return run(() => stepUpService.grantWithEmailCode(viewerEmail, code.trim()));
  };

  const stepUpSheet = (
    <BottomSheet visible={visible} onClose={close} title="Confirm it's you" subtitle="We check again before money leaves your wallet or a payout account changes." scrollable>
      <View style={{ gap: spacing[3] }}>
        {mode === "password" ? (
          <TextField label="Password" password value={password} onChangeText={setPassword} autoComplete="current-password" invalid={!!error} />
        ) : codeSent ? (
          <TextField label={`Code sent to ${viewerEmail}`} keyboardType="number-pad" maxLength={6} value={code} onChangeText={setCode} autoComplete="one-time-code" invalid={!!error} />
        ) : (
          <Text>{`We'll email a 6-digit code to ${viewerEmail}.`}</Text>
        )}
        {error ? <Text accessibilityRole="alert">{error}</Text> : null}
        <Button title={mode === "email" && !codeSent ? "Email me a code" : "Confirm"} loading={busy} disabled={busy} onPress={() => void submit()} />
        {viewerEmail ? (
          <Button variant="subtle" title={mode === "password" ? "No password? Use an emailed code" : "Use my password instead"} onPress={() => { setError(null); setMode(mode === "password" ? "email" : "password"); }} />
        ) : null}
      </View>
    </BottomSheet>
  );

  return { withStepUp, stepUpSheet };
}
