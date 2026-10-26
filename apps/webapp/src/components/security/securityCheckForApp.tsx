"use client";

import { useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";

import { TurnstileWidget } from "./turnstileWidget";
import styles from "./humanVerificationDialog.module.css";

const siteKey = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY ?? "";
const allowedReturnPrefix = "zudomart://security-check";

function SecurityCheckContent() {
  const searchParams = useSearchParams();
  const [message, setMessage] = useState<string | null>(null);
  const returnUrl = searchParams.get("return") ?? "";
  const action = (searchParams.get("reason") ?? "security_check").replace(/[^a-z_]/g, "").slice(0, 32) || "security_check";
  const isValidReturn = returnUrl === allowedReturnPrefix || returnUrl.startsWith(`${allowedReturnPrefix}?`);

  function returnToApp(token: string) {
    if (!isValidReturn) {
      setMessage("Check complete. Go back to the Nantty app to continue.");
      return;
    }
    window.location.replace(`${returnUrl}#token=${encodeURIComponent(token)}`);
  }

  return (
    <main className={styles.body} style={{ minHeight: "100dvh", justifyContent: "center", padding: "var(--space-4)" }}>
      <h1>Quick security check</h1>
      <p className={styles.status}>Confirm you&apos;re a person, then you&apos;ll go straight back to the app.</p>
      {siteKey === "" ? <p className={styles.error} role="alert">Security checks are not set up yet.</p> : <TurnstileWidget siteKey={siteKey} action={action} onToken={returnToApp} onError={() => setMessage("The check didn't load. Check your connection and try again.")} />}
      {message ? <p className={styles.status} role="status">{message}</p> : null}
      <p className={styles.privacy}>Protected by Cloudflare Turnstile.</p>
    </main>
  );
}

export function SecurityCheckForApp() {
  return (
    <Suspense fallback={null}>
      <SecurityCheckContent />
    </Suspense>
  );
}
