"use client";

import { FormEvent, useEffect, useRef, useState } from "react";

import styles from "./nanttyLanding.module.css";

const waitlistEndpoint = process.env.NEXT_PUBLIC_WAITLIST_APPS_SCRIPT_URL?.trim() ?? "";
const waitlistEnabled = process.env.NEXT_PUBLIC_WAITLIST_ENABLED === "true" && waitlistEndpoint.length > 0;
const knownGoogleOrigins = new Set(["https://script.google.com"]);

interface WaitlistMessage {
  readonly type: "nantty-waitlist";
  readonly nonce: string;
  readonly status: "saved" | "duplicate" | "error";
  readonly message: string;
}

function isGoogleOrigin(origin: string): boolean {
  if (knownGoogleOrigins.has(origin)) return true;
  try {
    return new URL(origin).hostname.endsWith(".googleusercontent.com");
  } catch {
    return false;
  }
}

export function NanttyWaitlistForm() {
  const formRef = useRef<HTMLFormElement>(null);
  const frameRef = useRef<HTMLIFrameElement>(null);
  const nonceRef = useRef("");
  const timeoutRef = useRef<number | undefined>(undefined);
  const [status, setStatus] = useState(waitlistEnabled ? "Your signup goes to Nantty’s private waitlist Sheet." : "We’re preparing the waitlist. Check back soon.");
  const [statusKind, setStatusKind] = useState<"idle" | "pending" | "saved" | "duplicate" | "error">("idle");

  useEffect(() => () => window.clearTimeout(timeoutRef.current), []);

  useEffect(() => {
    function receiveSubmission(event: MessageEvent<WaitlistMessage>) {
      if (event.source !== frameRef.current?.contentWindow || !isGoogleOrigin(event.origin)) return;
      if (event.data?.type !== "nantty-waitlist" || event.data.nonce !== nonceRef.current) return;
      window.clearTimeout(timeoutRef.current);
      setStatus(event.data.message);
      setStatusKind(event.data.status);
      const submit = formRef.current?.querySelector<HTMLButtonElement>("button[type=submit]");
      if (submit) submit.disabled = false;
      if (event.data.status === "saved" || event.data.status === "duplicate") formRef.current?.reset();
    }
    window.addEventListener("message", receiveSubmission);
    return () => window.removeEventListener("message", receiveSubmission);
  }, []);

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    if (!waitlistEnabled) {
      event.preventDefault();
      setStatus("We’re preparing the waitlist. Check back soon.");
      return;
    }
    if (!event.currentTarget.reportValidity()) {
      event.preventDefault();
      return;
    }

    event.preventDefault();
    const form = event.currentTarget;
    nonceRef.current = crypto.randomUUID();
    const nonceInput = form.elements.namedItem("nonce");
    const originInput = form.elements.namedItem("origin");
    if (nonceInput instanceof HTMLInputElement) nonceInput.value = nonceRef.current;
    if (originInput instanceof HTMLInputElement) originInput.value = window.location.origin;
    form.action = waitlistEndpoint;
    setStatusKind("pending");
    setStatus("Sending your request securely…");
    const submit = form.querySelector<HTMLButtonElement>("button[type=submit]");
    if (submit) submit.disabled = true;
    form.submit();
    timeoutRef.current = window.setTimeout(() => {
      if (submit) submit.disabled = false;
      setStatusKind("error");
      setStatus("We couldn’t confirm your signup. Please try again.");
    }, 15_000);
  }

  return (
    <form ref={formRef} className={styles.waitlistForm} method="post" target="nantty-waitlist-response" onSubmit={handleSubmit}>
      <input type="hidden" name="origin" value="" />
      <input type="hidden" name="nonce" value="" />
      <label className={styles.honeypot}>
        Leave this field empty
        <input name="website" tabIndex={-1} autoComplete="off" />
      </label>
      <label className={`${styles.field} ${styles.fieldWide}`}>
        Email address
        <input type="email" name="email" autoComplete="email" maxLength={254} required placeholder="you@example.com" />
      </label>
      <label className={`${styles.field} ${styles.fieldWide}`}>
        I’m here as
        <select name="interest" defaultValue="buyer">
          <option value="buyer">A shopper</option>
          <option value="seller">A seller or business</option>
          <option value="creator">A creator</option>
        </select>
      </label>
      <label className={styles.consent}>
        <input type="checkbox" name="consent" value="yes" required />
        <span>Send me occasional Nantty launch updates. See the <a href="/waitlist-privacy">waitlist privacy notice</a> for access, deletion and opt-out instructions.</span>
      </label>
      <button className={styles.primaryButton} type="submit" disabled={!waitlistEnabled}>Join the waitlist</button>
      <p className={styles.formStatus} data-state={statusKind} role="status" aria-live="polite">{status}</p>
      <iframe ref={frameRef} className={styles.hiddenFrame} name="nantty-waitlist-response" title="Waitlist submission response" tabIndex={-1} />
    </form>
  );
}
