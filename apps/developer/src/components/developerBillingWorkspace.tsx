"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";

import { useDeveloperContext } from "./developerContextProvider";
import styles from "./developerCredentialsWorkspace.module.css";

type BillingView = {
  readonly organizationId: string;
  readonly planTier: "sandbox" | "starter" | "growth" | "enterprise";
  readonly status: string;
  readonly monthlyQuota: number;
  readonly usedThisMonth: number;
  readonly currentPeriodEnd?: string | null;
};

const plans = [
  { id: "sandbox", name: "Sandbox", quota: "10,000 req / month", summary: "Default evaluation allowance for building and testing." },
  { id: "starter", name: "Starter", quota: "100,000 req / month", summary: "Production Business Messaging integrations for early business launch." },
  { id: "growth", name: "Growth", quota: "1,000,000 req / month", summary: "Multi-application business messaging & automated webhook pipelines." },
  { id: "enterprise", name: "Enterprise", quota: "10,000,000 req / month", summary: "High-volume integrations with Admin-managed custom quotas." },
] as const;

export function DeveloperBillingWorkspace() {
  const { organizations, organizationId, setOrganizationId, loading } = useDeveloperContext();
  const [billing, setBilling] = useState<BillingView | null>(null);
  const [busyTier, setBusyTier] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const loadBilling = useCallback(async () => {
    if (!organizationId) {
      setBilling(null);
      return;
    }
    setError("");
    try {
      const res = await fetch(`/api/developer/organizations/${encodeURIComponent(organizationId)}/billing`, {
        credentials: "same-origin",
        cache: "no-store",
      });
      const data = (await res.json().catch(() => null)) as BillingView & { message?: string };
      if (!res.ok) throw new Error(data?.message ?? "Could not load organization billing.");
      setBilling(data);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not load organization billing.");
    }
  }, [organizationId]);

  useEffect(() => {
    void loadBilling();
  }, [loadBilling]);

  async function selectPlan(planTier: string) {
    if (!organizationId || busyTier) return;
    setBusyTier(planTier);
    setError("");
    setNotice("");
    try {
      const res = await fetch(`/api/developer/organizations/${encodeURIComponent(organizationId)}/billing/checkout`, {
        method: "POST",
        credentials: "same-origin",
        headers: { "content-type": "application/json", accept: "application/json" },
        body: JSON.stringify({ planTier }),
      });
      const data = (await res.json().catch(() => null)) as BillingView & { message?: string };
      if (!res.ok) throw new Error(data?.message ?? "Could not update subscription tier.");
      setBilling(data);
      setNotice(`Organization plan tier updated to ${data.planTier} (${data.monthlyQuota.toLocaleString()} monthly requests).`);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Plan update failed.");
    } finally {
      setBusyTier("");
    }
  }

  return (
    <section className={styles.page} aria-labelledby="billing-title">
      <header className={styles.header}>
        <div>
          <p className={styles.eyebrow}>Developer workspace / Organization</p>
          <h1 id="billing-title">Billing &amp; plans</h1>
          <p>View your organization’s current quota tier. Paid upgrades are unavailable until verified checkout is connected.</p>
        </div>
        <div className={styles.selectors}>
          <label>
            Organization
            <select value={organizationId} onChange={(e) => setOrganizationId(e.target.value)} disabled={loading || !organizations.length}>
              {organizations.length ? organizations.map((org) => <option key={org.id} value={org.id}>{org.name}</option>) : <option value="">No organizations</option>}
            </select>
          </label>
        </div>
      </header>

      <div className={styles.callout} role="note">
        <strong>Server-enforced tier entitlements</strong>
        <span>Sandbox is free and active by default. Paid checkout is not connected, so paid plan selection is disabled and no payment or entitlement change can be initiated here.</span>
      </div>

      {error ? <p className={styles.error} role="alert">{error}</p> : null}
      {notice ? <p className={styles.notice} role="status">{notice}</p> : null}

      {!organizations.length && !loading ? (
        <p className={styles.empty}>Create or join an organization to manage billing. <Link href="/organization">Manage organizations</Link></p>
      ) : billing ? (
        <section className={styles.records} aria-label="Current subscription">
          <div className={styles.recordsHeading}>
            <div>
              <h2>Current plan: {billing.planTier.toUpperCase()}</h2>
              <p>Status: {billing.status} · Used this month: {billing.usedThisMonth.toLocaleString()} / {billing.monthlyQuota.toLocaleString()}</p>
            </div>
            <button type="button" onClick={() => void loadBilling()}>Refresh</button>
          </div>
          <div className={styles.tableScroll}>
            <table>
              <thead>
                <tr><th scope="col">Plan</th><th scope="col">Monthly quota</th><th scope="col">Included scope</th><th scope="col">Action</th></tr>
              </thead>
              <tbody>
                {plans.map((plan) => {
                  const isCurrent = billing.planTier === plan.id;
                  return (
                    <tr key={plan.id}>
                      <td><strong>{plan.name}</strong></td>
                      <td>{plan.quota}</td>
                      <td>{plan.summary}</td>
                      <td>
                        {isCurrent ? (
                          <span className={`${styles.badge} ${styles.badgeSuccess}`}>Current plan</span>
                        ) : (
                          <button type="button" disabled={Boolean(busyTier) || plan.id !== "sandbox"} title={plan.id === "sandbox" ? undefined : "Paid checkout is not available yet."} onClick={() => void selectPlan(plan.id)}>
                            {busyTier === plan.id ? "Updating…" : plan.id === "sandbox" ? "Switch to Sandbox" : "Unavailable"}
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>
      ) : null}
    </section>
  );
}
