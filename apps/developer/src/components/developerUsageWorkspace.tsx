"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";

import { useDeveloperContext } from "./developerContextProvider";
import styles from "./developerCredentialsWorkspace.module.css";

type SandboxUsagePeriod = {
  readonly billingPeriod: string;
  readonly resetAt: string;
  readonly messagesSent: number;
  readonly requestsCount: number;
  readonly scenariosRun: number;
  readonly quotaLimitMessages: number;
  readonly remainingMessages: number;
};

type ProductionUsage = {
  readonly usedThisMonth: number;
  readonly monthlyQuota: number;
};

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(path, { ...init, credentials: "same-origin", cache: "no-store", headers: { accept: "application/json", ...init?.headers } });
  if (!response.ok) {
    const payload = (await response.json().catch(() => null)) as { message?: string; error?: { message?: string } } | null;
    throw new Error(payload?.error?.message ?? payload?.message ?? "Usage metrics could not be loaded.");
  }
  return response.json() as Promise<T>;
}

function formatDate(value: string): string {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "—" : new Intl.DateTimeFormat(undefined, { dateStyle: "medium" }).format(date);
}

export function DeveloperUsageWorkspace() {
  const { environment, organizations, organizationId, setOrganizationId, applications, applicationId, setApplicationId, loading } = useDeveloperContext();
  const [sandboxUsage, setSandboxUsage] = useState<SandboxUsagePeriod | null>(null);
  const [prodUsage, setProdUsage] = useState<ProductionUsage | null>(null);
  const [loadingUsage, setLoadingUsage] = useState(false);
  const [error, setError] = useState("");

  const loadUsage = useCallback(async (signal?: AbortSignal) => {
    if (!organizationId || !applicationId) {
      setSandboxUsage(null);
      setProdUsage(null);
      return;
    }
    setLoadingUsage(true);
    setError("");
    try {
      if (environment === "production") {
        const data = await request<ProductionUsage>(
          `/api/developer/organizations/${encodeURIComponent(organizationId)}/applications/${encodeURIComponent(applicationId)}/usage`,
          { signal },
        );
        if (!signal?.aborted) setProdUsage(data);
      } else {
        const data = await request<{ usage: SandboxUsagePeriod }>(
          `/api/developer/usage?${new URLSearchParams({ organizationId, applicationId })}`,
          { signal },
        );
        if (!signal?.aborted) setSandboxUsage(data.usage);
      }
    } catch (cause) {
      if (!signal?.aborted) setError(cause instanceof Error ? cause.message : "Could not load usage metrics.");
    } finally {
      if (!signal?.aborted) setLoadingUsage(false);
    }
  }, [applicationId, environment, organizationId]);

  useEffect(() => {
    const controller = new AbortController();
    void loadUsage(controller.signal);
    return () => controller.abort();
  }, [loadUsage]);

  return (
    <section className={styles.page} aria-labelledby="usage-title">
      <header className={styles.header}>
        <div>
          <p className={styles.eyebrow}>Developer workspace / Operate · {environment === "production" ? "Production" : "Sandbox"}</p>
          <h1 id="usage-title">Usage &amp; quotas</h1>
          <p>Inspect authoritative {environment === "production" ? "organization production" : "isolated Sandbox"} monthly allowances.</p>
        </div>
        <div className={styles.selectors}>
          <label>
            Organization
            <select value={organizationId} onChange={(e) => setOrganizationId(e.target.value)} disabled={loading || !organizations.length}>
              {organizations.length ? organizations.map((org) => <option key={org.id} value={org.id}>{org.name}</option>) : <option value="">No organizations</option>}
            </select>
          </label>
          <label>
            Application
            <select value={applicationId} onChange={(e) => setApplicationId(e.target.value)} disabled={!applications.length}>
              {applications.length ? applications.map((app) => <option key={app.id} value={app.id}>{app.name}</option>) : <option value="">No applications</option>}
            </select>
          </label>
        </div>
      </header>

      <div className={styles.callout} role="status">
        <strong>Sandbox and Production quotas are metered independently</strong>
        <span>Sandbox resets do not clear Sandbox quota counters. Production tier upgrades can be managed on the <Link href="/billing">Billing &amp; plans</Link> page.</span>
      </div>

      {error ? <p className={styles.error} role="alert">{error}</p> : null}

      <section className={styles.records} aria-label="Usage metrics">
        <div className={styles.recordsHeading}>
          <div>
            <h2>Current {environment} period</h2>
            <p>Requests exceeding the monthly allowance are rejected with HTTP 429.</p>
          </div>
          <div className={styles.listTools}>
            <button type="button" onClick={() => void loadUsage()} disabled={loadingUsage || !applicationId}>
              {loadingUsage ? "Refreshing..." : "Refresh"}
            </button>
          </div>
        </div>

        {loading ? <p className={styles.empty}>Loading organizations...</p> : !organizations.length ? (
          <p className={styles.empty}>Create or join a developer organization first. <Link href="/organization">Manage organizations</Link></p>
        ) : !applications.length ? (
          <p className={styles.empty}>Register an application first. <Link href="/applications">Register application</Link></p>
        ) : environment === "production" && prodUsage ? (
          <>
            <dl className={styles.usageGrid} aria-label="Production usage summary">
              <div className={styles.usageCard}><dt>Requests this month</dt><dd>{prodUsage.usedThisMonth.toLocaleString()}</dd></div>
              <div className={styles.usageCard}><dt>Monthly quota</dt><dd>{prodUsage.monthlyQuota.toLocaleString()}</dd></div>
              <div className={styles.usageCard}><dt>Remaining</dt><dd>{Math.max(0, prodUsage.monthlyQuota - prodUsage.usedThisMonth).toLocaleString()}</dd></div>
            </dl>
            {(() => {
              const limit = Math.max(1, prodUsage.monthlyQuota);
              const pct = Math.min(100, Math.round((prodUsage.usedThisMonth / limit) * 100));
              const fillTone = pct >= 95 ? styles.quotaFillDanger : pct >= 75 ? styles.quotaFillWarn : "";
              return (
                <div className={styles.quotaPanel}>
                  <div className={styles.quotaHeader}>
                    <strong>Monthly production API allowance</strong>
                    <span>{prodUsage.usedThisMonth.toLocaleString()} / {prodUsage.monthlyQuota.toLocaleString()} ({pct}%)</span>
                  </div>
                  <div className={styles.quotaTrack} role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100} aria-label="Monthly production quota utilization">
                    <div className={`${styles.quotaFill} ${fillTone}`} style={{ width: `${pct}%` }} />
                  </div>
                </div>
              );
            })()}
          </>
        ) : environment === "sandbox" && sandboxUsage ? (
          <>
            <dl className={styles.usageGrid} aria-label="Usage summary">
              <div className={styles.usageCard}><dt>Messages sent</dt><dd>{sandboxUsage.messagesSent.toLocaleString()}</dd></div>
              <div className={styles.usageCard}><dt>Remaining quota</dt><dd>{sandboxUsage.remainingMessages.toLocaleString()}</dd></div>
              <div className={styles.usageCard}><dt>API requests</dt><dd>{sandboxUsage.requestsCount.toLocaleString()}</dd></div>
              <div className={styles.usageCard}><dt>Scenarios run</dt><dd>{sandboxUsage.scenariosRun.toLocaleString()}</dd></div>
            </dl>
            {(() => {
              const limit = Math.max(1, sandboxUsage.quotaLimitMessages);
              const pct = Math.min(100, Math.round((sandboxUsage.messagesSent / limit) * 100));
              const fillTone = pct >= 95 ? styles.quotaFillDanger : pct >= 75 ? styles.quotaFillWarn : "";
              return (
                <div className={styles.quotaPanel}>
                  <div className={styles.quotaHeader}>
                    <strong>Monthly outbound message quota ({sandboxUsage.billingPeriod})</strong>
                    <span>{sandboxUsage.messagesSent.toLocaleString()} / {sandboxUsage.quotaLimitMessages.toLocaleString()} ({pct}%) · resets {formatDate(sandboxUsage.resetAt)}</span>
                  </div>
                  <div className={styles.quotaTrack} role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100} aria-label="Monthly sandbox message quota utilization">
                    <div className={`${styles.quotaFill} ${fillTone}`} style={{ width: `${pct}%` }} />
                  </div>
                </div>
              );
            })()}
          </>
        ) : (
          <p className={styles.empty}>{loadingUsage ? "Loading usage metrics..." : "Select an application to inspect usage."}</p>
        )}
      </section>
    </section>
  );
}
