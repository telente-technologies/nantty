"use client";

import { FormEvent, useEffect, useRef, useState } from "react";

import styles from "./nanttyLanding.module.css";

// This is a public Apps Script web-app URL, not a credential. Keeping a
// fallback prevents static hosting builds from silently disabling signups
// when a build-time environment variable was not configured.
const defaultWaitlistEndpoint = "https://script.google.com/macros/s/AKfycbw9zv0GRV4qjvuMiU5cNifUUKPZV18u3rUHBqjFN17C6VeOBEnrNiDJYLEK-FK7kQcV/exec";
const waitlistEndpoint = process.env.NEXT_PUBLIC_WAITLIST_APPS_SCRIPT_URL?.trim() || defaultWaitlistEndpoint;
const waitlistEnabled = process.env.NEXT_PUBLIC_WAITLIST_ENABLED !== "false" && waitlistEndpoint.length > 0;
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
  const [interest, setInterest] = useState("buyer");
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
      if (event.data.status === "saved" || event.data.status === "duplicate") {
        formRef.current?.reset();
        setInterest("buyer");
      }
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
        I’m joining as
        <select name="interest" value={interest} onChange={(event) => setInterest(event.currentTarget.value)}>
          <option value="buyer">A buyer / shopper</option>
          <option value="seller">A seller or business</option>
          <option value="creator">A creator</option>
        </select>
      </label>
      {interest === "seller" ? (
        <fieldset className={`${styles.waitlistSellerDetails} ${styles.fieldWide}`}>
          <legend>Seller details <span>(optional)</span></legend>
          <p className={styles.sellerDetailsHelp}>Share a little about your store so we can plan seller onboarding. You can join without answering these questions.</p>
          <label className={styles.field}>
            Your name
            <input type="text" name="fullName" autoComplete="name" maxLength={120} placeholder="Full name" />
          </label>
          <label className={styles.field}>
            Store or business name
            <input type="text" name="businessName" autoComplete="organization" maxLength={160} placeholder="Business name" />
          </label>
          <label className={styles.field}>
            Phone or WhatsApp <span>(optional)</span>
            <input type="tel" name="phone" autoComplete="tel" maxLength={32} placeholder="e.g. +234 …" />
          </label>
          <label className={styles.field}>
            Main product category
            <select name="productCategory" defaultValue="">
              <option value="">Choose a category</option>
              <option value="Fashion and clothing">Fashion and clothing</option>
              <option value="Beauty and personal care">Beauty and personal care</option>
              <option value="Food and groceries">Food and groceries</option>
              <option value="Home and kitchen">Home and kitchen</option>
              <option value="Health and wellness">Health and wellness</option>
              <option value="Phones and gadgets">Phones and gadgets</option>
              <option value="Perfume and fragrance">Perfume and fragrance</option>
              <option value="Other">Other</option>
            </select>
          </label>
          <fieldset className={styles.salesChannels}>
            <legend>Where do you sell today?</legend>
            <div>
              {[
                "Instagram",
                "WhatsApp",
                "TikTok",
                "Facebook",
                "Physical shop",
                "Online store",
                "Other",
              ].map((channel) => (
                <label key={channel}>
                  <input type="checkbox" name="salesChannels" value={channel} />
                  <span>{channel}</span>
                </label>
              ))}
            </div>
          </fieldset>
          <label className={styles.field}>
            Approximate monthly sales (NGN) <span>(optional)</span>
            <input type="number" name="monthlySales" min="0" max="999999999999" step="1" inputMode="numeric" placeholder="Prefer not to say? Leave blank" />
          </label>
          <label className={styles.field}>
            Products you expect to list at launch
            <input type="number" name="productCount" min="0" max="1000000" step="1" inputMode="numeric" placeholder="e.g. 20" />
          </label>
          <label className={styles.field}>
            Would you like to join the founding-seller beta?
            <select name="foundingSellerBeta" defaultValue="">
              <option value="">Choose an answer</option>
              <option value="yes">Yes</option>
              <option value="no">No</option>
            </select>
          </label>
          <label className={styles.field}>
            When could you start listing?
            <select name="listingTiming" defaultValue="">
              <option value="">Choose a timeframe</option>
              <option value="As soon as the closed beta opens">As soon as the closed beta opens</option>
              <option value="Within 1 month of launch">Within one month of launch</option>
              <option value="Not sure yet">Not sure yet</option>
            </select>
          </label>
        </fieldset>
      ) : null}
      <label className={styles.consent}>
        <input type="checkbox" name="processingConsent" value="yes" required />
        <span>I agree that Nantty may use the details I provide to manage my waitlist request, as described in the <a href="/waitlist-privacy">waitlist privacy notice</a>.</span>
      </label>
      <label className={styles.consent}>
        <input type="checkbox" name="consent" value="yes" />
        <span>Send me occasional Nantty launch updates. This is optional and separate from joining the waitlist.</span>
      </label>
      <button className={styles.primaryButton} type="submit" disabled={!waitlistEnabled}>Join the waitlist</button>
      <p className={styles.formStatus} data-state={statusKind} role="status" aria-live="polite">{status}</p>
      <iframe ref={frameRef} className={styles.hiddenFrame} name="nantty-waitlist-response" title="Waitlist submission response" tabIndex={-1} />
    </form>
  );
}
