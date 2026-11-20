"use client";

import { useEffect, useRef, useState, type ClipboardEvent, type FormEvent, type KeyboardEvent } from "react";

import { CheckCircleIcon, EnvelopeSimpleIcon, LockKeyIcon, ShieldCheckIcon } from "@/components/ui/icons";

import styles from "./stepUpVerification.module.css";

export interface StepUpResult {
  readonly stepUpToken: string;
  readonly method: "otp" | "password";
  readonly expiresIn?: number;
}

interface StepUpVerificationPanelProps {
  readonly title?: string;
  readonly description?: string;
  readonly submitLabel?: string;
  readonly defaultEmail?: string;
  readonly onVerified?: (result: StepUpResult) => void | Promise<void>;
  readonly onCancel?: () => void;
  readonly busyExternal?: boolean;
}

export function StepUpVerificationPanel({
  title = "Verify your identity",
  description = "Complete step-up verification with a 6-digit email one-time code or your Nantty account password.",
  submitLabel = "Confirm identity",
  defaultEmail = "",
  onVerified,
  onCancel,
  busyExternal = false,
}: StepUpVerificationPanelProps) {
  const [method, setMethod] = useState<"otp" | "password">("otp");
  const [email, setEmail] = useState(defaultEmail);
  const [codeDigits, setCodeDigits] = useState<string[]>(["", "", "", "", "", ""]);
  const [codeSent, setCodeSent] = useState(false);
  const [resendCooldown, setResendCooldown] = useState(0);
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [verifiedGrant, setVerifiedGrant] = useState<StepUpResult | null>(null);
  const digitRefs = useRef<Array<HTMLInputElement | null>>([]);

  useEffect(() => {
    if (resendCooldown <= 0) return;
    const timer = window.setTimeout(() => setResendCooldown((prev) => Math.max(0, prev - 1)), 1000);
    return () => window.clearTimeout(timer);
  }, [resendCooldown]);

  const combinedCode = codeDigits.join("");

  async function sendOtpCode() {
    const trimmed = email.trim();
    if (trimmed.length < 3 || !trimmed.includes("@")) {
      setError("Enter a valid Nantty account email address first.");
      return;
    }
    setBusy(true);
    setError("");
    setNotice("");
    try {
      const response = await fetch("/api/developer/otp/send", {
        method: "POST",
        credentials: "same-origin",
        cache: "no-store",
        headers: { accept: "application/json", "content-type": "application/json" },
        body: JSON.stringify({ destination: trimmed, purpose: "login" }),
      });
      const payload = (await response.json().catch(() => null)) as { expiresIn?: number; message?: string } | null;
      if (!response.ok) {
        throw new Error(payload?.message ?? "Could not send a verification code right now.");
      }
      setCodeSent(true);
      setResendCooldown(60);
      setCodeDigits(["", "", "", "", "", ""]);
      setNotice(`A 6-digit verification code was sent to ${trimmed}.`);
      window.setTimeout(() => digitRefs.current[0]?.focus(), 20);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not send verification code.");
    } finally {
      setBusy(false);
    }
  }

  function handleDigitChange(index: number, raw: string) {
    const cleaned = raw.replace(/\D/g, "");
    if (!cleaned) {
      setCodeDigits((prev) => prev.map((d, i) => (i === index ? "" : d)));
      return;
    }
    if (cleaned.length > 1) {
      const next = [...codeDigits];
      for (let i = 0; i < 6 && i < cleaned.length; i += 1) {
        next[i] = cleaned[i] ?? "";
      }
      setCodeDigits(next);
      const focusIdx = Math.min(5, cleaned.length - 1);
      digitRefs.current[focusIdx]?.focus();
      return;
    }
    setCodeDigits((prev) => prev.map((d, i) => (i === index ? cleaned : d)));
    if (index < 5) {
      digitRefs.current[index + 1]?.focus();
    }
  }

  function handleDigitKeyDown(index: number, event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === "Backspace" && !codeDigits[index] && index > 0) {
      digitRefs.current[index - 1]?.focus();
    } else if (event.key === "ArrowLeft" && index > 0) {
      event.preventDefault();
      digitRefs.current[index - 1]?.focus();
    } else if (event.key === "ArrowRight" && index < 5) {
      event.preventDefault();
      digitRefs.current[index + 1]?.focus();
    }
  }

  function handleDigitPaste(event: ClipboardEvent<HTMLInputElement>) {
    const pasted = event.clipboardData.getData("text").replace(/\D/g, "").slice(0, 6);
    if (!pasted) return;
    event.preventDefault();
    const next = ["", "", "", "", "", ""];
    for (let i = 0; i < pasted.length; i += 1) {
      next[i] = pasted[i] ?? "";
    }
    setCodeDigits(next);
    digitRefs.current[Math.min(5, pasted.length - 1)]?.focus();
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy || busyExternal) return;
    setError("");
    setNotice("");
    setBusy(true);
    try {
      let stepUpBody: Record<string, string>;
      if (method === "otp") {
        const trimmedEmail = email.trim();
        if (!trimmedEmail || !/^\d{6}$/.test(combinedCode)) {
          throw new Error("Enter your account email and all 6 digits of the verification code.");
        }
        const verifyRes = await fetch("/api/developer/otp/verify", {
          method: "POST",
          credentials: "same-origin",
          cache: "no-store",
          headers: { accept: "application/json", "content-type": "application/json" },
          body: JSON.stringify({ destination: trimmedEmail, code: combinedCode, purpose: "login" }),
        });
        const verifyPayload = (await verifyRes.json().catch(() => null)) as { otpToken?: string; message?: string } | null;
        if (!verifyRes.ok || !verifyPayload?.otpToken) {
          throw new Error(verifyPayload?.message ?? "That 6-digit code could not be verified.");
        }
        stepUpBody = { otpToken: verifyPayload.otpToken };
      } else {
        if (!password) {
          throw new Error("Enter your Nantty account password.");
        }
        stepUpBody = { password };
      }

      const stepUpRes = await fetch("/api/developer/step-up", {
        method: "POST",
        credentials: "same-origin",
        cache: "no-store",
        headers: { accept: "application/json", "content-type": "application/json" },
        body: JSON.stringify(stepUpBody),
      });
      const stepUpPayload = (await stepUpRes.json().catch(() => null)) as { stepUpToken?: string; expiresIn?: number; message?: string } | null;
      setPassword("");
      if (!stepUpRes.ok || !stepUpPayload?.stepUpToken) {
        throw new Error(stepUpPayload?.message ?? "Identity confirmation failed.");
      }

      const grant: StepUpResult = {
        stepUpToken: stepUpPayload.stepUpToken,
        method,
        expiresIn: stepUpPayload.expiresIn ?? 300,
      };
      setVerifiedGrant(grant);
      setNotice("Step-up verification complete. Single-use token issued.");
      await onVerified?.(grant);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not verify your identity.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form className={styles.panel} onSubmit={handleSubmit} aria-labelledby="step-up-title">
      <div className={styles.head}>
        <div className={styles.titleWrap}>
          <ShieldCheckIcon size={20} className={styles.titleIcon} />
          <div>
            <h3 id="step-up-title">{title}</h3>
            <p>{description}</p>
          </div>
        </div>
        <div className={styles.methodSwitch} role="tablist" aria-label="Verification method">
          <button
            type="button"
            role="tab"
            aria-selected={method === "otp"}
            className={`${styles.methodTab} ${method === "otp" ? styles.methodTabActive : ""}`}
            onClick={() => { setMethod("otp"); setError(""); }}
          >
            <EnvelopeSimpleIcon size={15} />
            <span>Email OTP</span>
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={method === "password"}
            className={`${styles.methodTab} ${method === "password" ? styles.methodTabActive : ""}`}
            onClick={() => { setMethod("password"); setError(""); }}
          >
            <LockKeyIcon size={15} />
            <span>Password</span>
          </button>
        </div>
      </div>

      {method === "otp" ? (
        <div className={styles.otpFlow}>
          <div className={styles.emailRow}>
            <label className={styles.fieldLabel}>
              Account email
              <input
                type="email"
                required
                autoComplete="email"
                placeholder="you@company.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </label>
            <button
              type="button"
              className={styles.sendCodeBtn}
              disabled={busy || busyExternal || resendCooldown > 0}
              onClick={() => void sendOtpCode()}
            >
              {resendCooldown > 0 ? `Resend in ${resendCooldown}s` : codeSent ? "Resend code" : "Send 6-digit code"}
            </button>
          </div>

          <div className={styles.otpGroup}>
            <span className={styles.otpLabel}>6-digit verification code</span>
            <div className={styles.otpBoxes} role="group" aria-label="6-digit verification code">
              {codeDigits.map((digit, index) => (
                <input
                  key={index}
                  ref={(el) => { digitRefs.current[index] = el; }}
                  type="text"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  maxLength={6}
                  autoComplete={index === 0 ? "one-time-code" : "off"}
                  aria-label={`Verification digit ${index + 1}`}
                  className={styles.otpDigit}
                  value={digit}
                  onChange={(e) => handleDigitChange(index, e.target.value)}
                  onKeyDown={(e) => handleDigitKeyDown(index, e)}
                  onPaste={handleDigitPaste}
                />
              ))}
            </div>
            <span className={styles.otpHint}>Paste a 6-digit code from your inbox or type each digit.</span>
          </div>
        </div>
      ) : (
        <label className={styles.fieldLabel}>
          Nantty account password
          <input
            type="password"
            required
            autoComplete="current-password"
            placeholder="Enter your current password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </label>
      )}

      {error ? <p className={styles.error} role="alert">{error}</p> : null}
      {notice ? (
        <p className={styles.success} role="status">
          <CheckCircleIcon size={16} />
          <span>{notice}</span>
        </p>
      ) : null}

      {verifiedGrant ? (
        <div className={styles.grantSummary}>
          <strong>Verification active</strong>
          <span>Method: {verifiedGrant.method === "otp" ? "Email OTP" : "Password"} · Expires in {verifiedGrant.expiresIn ?? 300}s</span>
        </div>
      ) : null}

      <div className={styles.actions}>
        {onCancel ? (
          <button type="button" className={styles.cancelBtn} disabled={busy || busyExternal} onClick={onCancel}>
            Cancel
          </button>
        ) : null}
        <button
          type="submit"
          className={styles.submitBtn}
          disabled={busy || busyExternal || (method === "otp" ? combinedCode.length !== 6 : !password)}
        >
          {busy || busyExternal ? "Verifying…" : submitLabel}
        </button>
      </div>
    </form>
  );
}
