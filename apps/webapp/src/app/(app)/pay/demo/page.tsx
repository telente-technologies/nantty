"use client";

import { useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";

import styles from "@/components/actions/paymentReturnStatus.module.css";
import { Button } from "@/components/ui/button";
import { sendRequestToWebappServer } from "@/services/clientApi.service";
import { readSafeRelativeRedirectPath } from "@/utils/safeRedirectPath.util";

function withProviderParams(path: string, status: string, reference: string): string {
  const separator = path.includes("?") ? "&" : "?";
  return `${path}${separator}status=${status}&tx_ref=${encodeURIComponent(reference)}&transaction_id=demo`;
}

function DemoHostedCheckout() {
  const searchParams = useSearchParams();
  const reference = searchParams.get("reference") ?? "";
  const next = readSafeRelativeRedirectPath(searchParams.get("next"), "/pay/return");
  const [busy, setBusy] = useState(false);
  const decline = async () => {
    setBusy(true);
    await sendRequestToWebappServer(`/api/v1/payments/demo/${encodeURIComponent(reference)}/decline`, { method: "POST" }).catch(() => null);
    window.location.assign(withProviderParams(next, "successful", reference));
  };
  return (
    <div className={styles.card}>
      <h1 className={styles.title}>Payment partner page (demo)</h1>
      <p className={styles.text}>With the real backend this is our payment partner&apos;s secure page. No money moves in demo mode. Reference {reference || "unknown"}.</p>
      <Button busy={busy} disabled={!reference} onClick={() => window.location.assign(withProviderParams(next, "successful", reference))}>Pay</Button>
      <Button variant="secondary" disabled={!reference || busy} onClick={decline}>Simulate a failed payment (the return link still says success)</Button>
      <Button variant="secondary" onClick={() => window.location.assign(withProviderParams(next, "cancelled", reference))}>Cancel</Button>
    </div>
  );
}

export default function DemoHostedCheckoutPage() {
  return (
    <Suspense fallback={null}>
      <DemoHostedCheckout />
    </Suspense>
  );
}
