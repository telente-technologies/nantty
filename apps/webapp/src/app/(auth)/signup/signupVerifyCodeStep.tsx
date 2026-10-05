"use client";

import { useRef } from "react";

import { Button } from "@/components/ui/button";

import stepStyles from "../authSteps.module.css";

interface SignUpVerifyCodeStepProps {
  readonly code: string;
  readonly hasError: boolean;
  readonly isBusy: boolean;
  readonly canContinue: boolean;
  readonly resendSeconds: number;
  readonly onCodeChange: (code: string) => void;
  readonly onCompleteCode: (code: string) => void;
  readonly onResend: () => void;
}

export function SignUpVerifyCodeStep({ code, hasError, isBusy, canContinue, resendSeconds, onCodeChange, onCompleteCode, onResend }: SignUpVerifyCodeStepProps) {
  const otpInputRef = useRef<HTMLInputElement>(null);
  return (
    <>
      <div className={stepStyles.otpRow} onClick={() => otpInputRef.current?.focus()}>
        <input
          ref={otpInputRef}
          className={stepStyles.otpHiddenInput}
          inputMode="numeric"
          autoComplete="one-time-code"
          pattern="\d{6}"
          maxLength={6}
          aria-label="Verification code"
          value={code}
          autoFocus
          onChange={(event) => {
            const next = event.target.value.replace(/\D/g, "").slice(0, 6);
            onCodeChange(next);
            if (next.length === 6) onCompleteCode(next);
          }}
        />
        {Array.from({ length: 6 }, (_, index) => {
          const isActive = index === Math.min(code.length, 5);
          const classes = [stepStyles.otpBox, isActive ? stepStyles.otpBoxActive : "", hasError ? stepStyles.otpBoxInvalid : ""].filter(Boolean).join(" ");
          return (
            <span key={index} className={classes}>
              {code[index] ?? ""}
            </span>
          );
        })}
      </div>

      <div className={stepStyles.resendRow}>
        {resendSeconds > 0 ? (
          <button type="button" className={stepStyles.resendButton} disabled>
            Resend code {resendSeconds}s
          </button>
        ) : (
          <button type="button" className={stepStyles.resendButtonLink} onClick={onResend}>
            Resend code
          </button>
        )}
      </div>
      <p className={stepStyles.resendRow}>Didn’t get it? Check your spam folder, then resend.</p>

      <Button type="submit" fullWidth size="lg" busy={isBusy} disabled={!canContinue}>
        Next
      </Button>
    </>
  );
}
