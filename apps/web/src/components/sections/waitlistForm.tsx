"use client";

import { useId, useState, type FormEvent } from "react";

import { validateEmailAddressFormat } from "@/lib/emailValidation.util";
import { submitWaitlistEmailToApi } from "@/lib/waitlist.service";
import type { WaitlistFormStatus, WaitlistRole } from "@/types/waitlist.types";

import { FigmaIconTintedWithCurrentColor } from "../ui/figmaIcon";
import styles from "./waitlistForm.module.css";

interface WaitlistFormProps {
  readonly source: string;
  readonly defaultRole?: WaitlistRole;
  readonly showRolePicker?: boolean;
  readonly tone?: "light" | "dark";
  readonly submitLabel?: string;
}

const roleOptions: ReadonlyArray<{ readonly value: WaitlistRole; readonly label: string }> = [
  { value: "buyer", label: "I want to shop" },
  { value: "seller", label: "I want to sell" },
];

export function WaitlistEmailSignupForm({ source, defaultRole = "buyer", showRolePicker = false, tone = "light", submitLabel = "Join the waitlist" }: WaitlistFormProps) {
  const fieldId = useId();
  const [emailAddress, setEmailAddress] = useState("");
  const [honeypotValue, setHoneypotValue] = useState("");
  const [selectedRole, setSelectedRole] = useState<WaitlistRole>(defaultRole);
  const [formStatus, setFormStatus] = useState<WaitlistFormStatus>("idle");
  const [feedbackMessage, setFeedbackMessage] = useState("");

  async function handleWaitlistFormSubmission(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (formStatus === "submitting") return;
    const validationError = validateEmailAddressFormat(emailAddress);
    if (validationError) {
      setFormStatus("failed");
      setFeedbackMessage(validationError);
      return;
    }
    if (honeypotValue.length > 0) {
      setFormStatus("joined");
      setFeedbackMessage("You're on the list. We'll email you when Zudomart opens.");
      return;
    }
    setFormStatus("submitting");
    setFeedbackMessage("");
    const signupResult = await submitWaitlistEmailToApi({ email: emailAddress, role: selectedRole, source });
    setFormStatus(signupResult.outcome);
    setFeedbackMessage(signupResult.message);
    if (signupResult.outcome === "joined") setEmailAddress("");
  }

  const emailInputId = `${fieldId}-email`;
  const feedbackId = `${fieldId}-feedback`;
  const hasError = formStatus === "failed";

  if (formStatus === "joined") {
    return (
      <div className={`${styles.form} ${styles[tone]}`}>
        <p className={styles.joinedMessage} role="status">
          <FigmaIconTintedWithCurrentColor name="sealCheck20" size={20} />
          {feedbackMessage}
        </p>
      </div>
    );
  }

  return (
    <form className={`${styles.form} ${styles[tone]}`} onSubmit={handleWaitlistFormSubmission} noValidate aria-busy={formStatus === "submitting"}>
      {showRolePicker ? (
        <fieldset className={styles.roleFieldset}>
          <legend className="visuallyHidden">What do you want to do on Zudomart?</legend>
          {roleOptions.map((roleOption) => (
            <label key={roleOption.value} className={styles.roleOption}>
              <input type="radio" name={`${fieldId}-role`} value={roleOption.value} checked={selectedRole === roleOption.value} onChange={() => setSelectedRole(roleOption.value)} />
              <span>{roleOption.label}</span>
            </label>
          ))}
        </fieldset>
      ) : null}
      <div className={styles.inputRow}>
        <label htmlFor={emailInputId} className="visuallyHidden">
          Email address
        </label>
        <input
          id={emailInputId}
          type="email"
          name="email"
          inputMode="email"
          autoComplete="email"
          placeholder="you@example.com"
          maxLength={254}
          required
          value={emailAddress}
          onChange={(event) => setEmailAddress(event.target.value)}
          aria-invalid={hasError}
          aria-describedby={feedbackId}
          className={styles.emailInput}
        />
        <button type="submit" className={styles.submitButton} disabled={formStatus === "submitting"}>
          {formStatus === "submitting" ? "Joining…" : submitLabel}
        </button>
      </div>
      <div className={styles.honeypot} aria-hidden="true">
        <label htmlFor={`${fieldId}-company`}>Company</label>
        <input id={`${fieldId}-company`} type="text" name="company" tabIndex={-1} autoComplete="off" value={honeypotValue} onChange={(event) => setHoneypotValue(event.target.value)} />
      </div>
      <p id={feedbackId} className={hasError ? styles.errorMessage : styles.hintMessage} role={hasError ? "alert" : undefined} aria-live="polite">
        {hasError ? feedbackMessage : "One email when we launch. No spam, unsubscribe any time."}
      </p>
    </form>
  );
}
