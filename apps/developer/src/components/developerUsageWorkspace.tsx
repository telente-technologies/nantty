"use client";

import { useCallback, useEffect, useState } from "react";

import styles from "./developerCredentialsWorkspace.module.css";

type Organization = { readonly id: string; readonly name: string };
type Application = { readonly id: string; readonly name: string; readonly status: string };
type UsagePeriod = {
  readonly periodStart: string;
  readonly periodEnd: string;
  readonly messagesSent: number;
  readonly requestsCount: number;
  readonly scenariosRun: number;
  readonly quotaLimitMessages: number;
  readonly remainingMessages: number;
};

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(path, { ...init, credentials: "same-origin", cache: "no-store", headers: { accept: "application/json", ...init?.headers } });
  if (!response.ok) {
    const payload = await response.json().catch(() => null) as { message?: string; error?: { message?: string } } | null;
    throw new Error(payload?.error?.message ?? payload?.message ?? "Usage metrics could not be loaded.");
  }
  return response.json() as Promise<T>;
}

function formatDate(value: string): string {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "—" : new Intl.DateTimeFormat(undefined, { dateStyle: "medium" }).format(date);
}

export function DeveloperUsageWorkspace() {
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [organizationId, setOrganizationId] = useState("");
  const [applications, setApplications] = useState<Application[]>([]);
  const [applicationId, setApplicationId] = useState("");
  const [usage, setUsage] = useState<UsagePeriod | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingUsage, setLoadingUsage] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    void request<{ organizations: Organization[] }>("/api/developer/organizations")
      .then(({ organizations: items }) => { if (active) { setOrganizations(items); setOrganizationId(items[0]?.id ?? ""); } })
      .catch((cause: unknown) => { if (active) setError(cause instanceof Error ? cause.message : "Sign in to load your organizations."); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []);

  useEffect(() => {
    if (!organizationId) { setApplications([]); setApplicationId(""); return; }
    const controller = new AbortController();
    setApplications([]); setApplicationId(""); setUsage(null); setError("");
    void request<{ applications: Application[] }>(`/api/developer/organizations/${encodeURIComponent(organizationId)}/applications`, { signal: controller.signal })
      .then(({ applications: items }) => { if (!controller.signal.aborted) { setApplications(items); setApplicationId(items[0]?.id ?? ""); } })
      .catch((cause: unknown) => { if (!controller.signal.aborted) setError(cause instanceof Error ? cause.message : "Could not load applications."); });
    return () => controller.abort();
  }, [organizationId]);

  const loadUsage = useCallback(async (signal?: AbortSignal) => {
    if (!organizationId || !applicationId) { setUsage(null); return; }
    setLoadingUsage(true); setError("");
    try {
      const query = new URLSearchParams({ organizationId, applicationId });
      const data = await request<{ usage: UsagePeriod }>(`/api/developer/usage?${query}`, { signal });
      if (!signal?.aborted) setUsage(data.usage);
    } catch (cause) {
      if (!signal?.aborted) setError(cause instanceof Error ? cause.message : "Could not load sandbox usage metrics.");
    } finally {
      if (!signal?.aborted) setLoadingUsage(false);
    }
  }, [organizationId, applicationId]);

  useEffect(() => {
    const controller = new AbortController();
    void loadUsage(controller.signal);
    return () => controller.abort();
  }, [loadUsage]);

  return (
    <section className={styles.page} aria-labelledby="usage-title">
      <header className={styles.header}>
        <div>
          <p className={styles.eyebrow}>Developer workspace <span aria-hidden="true">/</span> Usage and billing</p>
          <h1 id="usage-title">Usage and billing</h1>
          <p>Inspect authoritative monthly Sandbox quotas and counters gated by your application-level <code>usage.read</code> grant.</p>
        </div>
        <div className={styles.selectors}>
          <label>
            Organization
            <select value={organizationId} onChange={(e) => setOrganizationId(e.target.value)} disabled={loading || !organizations.length}>
              {organizations.map((org) => <option key={org.id} value={org.id}>{org.name}</option>)}
            </select>
          </label>
          <label>
            Application
            <select value={applicationId} onChange={(e) => setApplicationId(e.target.value)} disabled={!applications.length}>
              {applications.map((app) => <option key={app.id} value={app.id}>{app.name}</option>)}
            </select>
          </label>
        </div>
      </header>

      <div className={styles.callout} role="status">
        <strong>Sandbox metering active — production billing and paid developer plans are not enabled</strong>
        <span>Counters reset automatically each calendar month and are preserved across synthetic sandbox resets. Paid plans, invoices, and spend limits are separate production release gates.</span>
      </div>

      {error ? <p className={styles.error} role="alert">{error}</p> : null}

      <section className={styles.records} aria-label="Sandbox billing period usage">
        <div className={styles.recordsHeading}>
          <div>
            <h2>Current sandbox billing period</h2>
            <p>Quota enforcement blocks outbound messages with HTTP 429 once the period limit is reached.</p>
          </div>
          <div className={styles.listTools}>
            <button type="button" onClick={() => void loadUsage()} disabled={loadingUsage || !applicationId}>
              {loadingUsage ? "Refreshing..." : "Refresh"}
            </button>
          </div>
        </div>

        {usage ? (
          <div className={styles.tableScroll}>
            <table>
              <thead>
                <tr>
                  <th scope="col">Period</th>
                  <th scope="col">Messages sent</th>
                  <th scope="col">Remaining quota</th>
                  <th scope="col">Quota limit</th>
                  <th scope="col">API requests</th>
                  <th scope="col">Scenarios run</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td>{formatDate(usage.periodStart)} – {formatDate(usage.periodEnd)}</td>
                  <td>{usage.messagesSent}</td>
                  <td>{usage.remainingMessages}</td>
                  <td>{usage.quotaLimitMessages}</td>
                  <td>{usage.requestsCount}</td>
                  <td>{usage.scenariosRun}</td>
                </tr>
              </tbody>
            </table>
          </div>
        ) : (
          <p className={styles.empty}>
            {loadingUsage ? "Loading sandbox usage metrics..." : "Select an application to inspect its sandbox usage period."}
          </p>
        )}
      </section>
    </section>
  );
}
