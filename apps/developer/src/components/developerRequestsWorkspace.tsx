"use client";

import { useCallback, useEffect, useState } from "react";

import styles from "./developerCredentialsWorkspace.module.css";

type Organization = { readonly id: string; readonly name: string };
type Application = { readonly id: string; readonly name: string; readonly status: string };
type RequestRecord = { readonly requestId: string; readonly method: string; readonly path: string; readonly statusCode: number; readonly createdAt: string };

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(path, { ...init, credentials: "same-origin", cache: "no-store", headers: { accept: "application/json", ...init?.headers } });
  if (!response.ok) {
    const payload = await response.json().catch(() => null) as { message?: string; error?: { message?: string } } | null;
    throw new Error(payload?.error?.message ?? payload?.message ?? "Request logs could not be loaded.");
  }
  return response.json() as Promise<T>;
}

function formatDate(value: string): string {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "—" : new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "medium" }).format(date);
}

export function DeveloperRequestsWorkspace() {
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [organizationId, setOrganizationId] = useState("");
  const [applications, setApplications] = useState<Application[]>([]);
  const [applicationId, setApplicationId] = useState("");
  const [requests, setRequests] = useState<RequestRecord[]>([]);
  const [methodFilter, setMethodFilter] = useState("ALL");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [loading, setLoading] = useState(true);
  const [loadingRows, setLoadingRows] = useState(false);
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
    setApplications([]); setApplicationId(""); setRequests([]); setError("");
    void request<{ applications: Application[] }>(`/api/developer/organizations/${encodeURIComponent(organizationId)}/applications`, { signal: controller.signal })
      .then(({ applications: items }) => { if (!controller.signal.aborted) { setApplications(items); setApplicationId(items[0]?.id ?? ""); } })
      .catch((cause: unknown) => { if (!controller.signal.aborted) setError(cause instanceof Error ? cause.message : "Could not load applications."); });
    return () => controller.abort();
  }, [organizationId]);

  const loadRequests = useCallback(async (signal?: AbortSignal) => {
    if (!organizationId || !applicationId) { setRequests([]); return; }
    setLoadingRows(true); setError("");
    try {
      const query = new URLSearchParams({ organizationId, applicationId });
      const data = await request<{ requests: RequestRecord[] }>(`/api/developer/requests?${query}`, { signal });
      if (!signal?.aborted) setRequests(data.requests);
    } catch (cause) {
      if (!signal?.aborted) setError(cause instanceof Error ? cause.message : "Could not load sandbox request logs.");
    } finally {
      if (!signal?.aborted) setLoadingRows(false);
    }
  }, [organizationId, applicationId]);

  useEffect(() => {
    const controller = new AbortController();
    void loadRequests(controller.signal);
    return () => controller.abort();
  }, [loadRequests]);

  const filtered = requests.filter((row) => {
    if (methodFilter !== "ALL" && row.method !== methodFilter) return false;
    if (statusFilter === "2XX" && (row.statusCode < 200 || row.statusCode >= 300)) return false;
    if (statusFilter === "4XX" && (row.statusCode < 400 || row.statusCode >= 500)) return false;
    if (statusFilter === "5XX" && row.statusCode < 500) return false;
    return true;
  });

  return (
    <section className={styles.page} aria-labelledby="requests-title">
      <header className={styles.header}>
        <div>
          <p className={styles.eyebrow}>Developer workspace <span aria-hidden="true">/</span> Request logs</p>
          <h1 id="requests-title">API request logs</h1>
          <p>Inspect redacted Sandbox API request outcomes gated by your application-level <code>request_logs.read</code> grant.</p>
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
        <strong>Sandbox traffic only — production API traffic remains closed</strong>
        <span>Only requests authenticated with a sandbox credential are recorded here. Authorization headers and request bodies are never stored.</span>
      </div>

      {error ? <p className={styles.error} role="alert">{error}</p> : null}

      <section className={styles.records} aria-label="Sandbox request log records">
        <div className={styles.recordsHeading}>
          <div>
            <h2>Recent sandbox requests</h2>
            <p>Newest 100 redacted records for the selected application.</p>
          </div>
          <div className={styles.listTools}>
            <select aria-label="Filter by method" value={methodFilter} onChange={(e) => setMethodFilter(e.target.value)}>
              <option value="ALL">All methods</option>
              <option value="GET">GET</option>
              <option value="POST">POST</option>
              <option value="PATCH">PATCH</option>
              <option value="DELETE">DELETE</option>
            </select>
            <select aria-label="Filter by status" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
              <option value="ALL">All statuses</option>
              <option value="2XX">2xx Success</option>
              <option value="4XX">4xx Client error</option>
              <option value="5XX">5xx Server error</option>
            </select>
            <button type="button" onClick={() => void loadRequests()} disabled={loadingRows || !applicationId}>
              {loadingRows ? "Refreshing..." : "Refresh"}
            </button>
          </div>
        </div>

        {filtered.length ? (
          <div className={styles.tableScroll}>
            <table>
              <thead>
                <tr>
                  <th scope="col">Request ID</th>
                  <th scope="col">Method</th>
                  <th scope="col">Path</th>
                  <th scope="col">Status</th>
                  <th scope="col">Recorded</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((row) => (
                  <tr key={row.requestId}>
                    <td><code>{row.requestId}</code></td>
                    <td><code>{row.method}</code></td>
                    <td><code>{row.path}</code></td>
                    <td>{row.statusCode}</td>
                    <td>{formatDate(row.createdAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className={styles.empty}>
            {loadingRows ? "Loading sandbox request records..." : "No sandbox request records match the selected application and filters."}
          </p>
        )}
      </section>
    </section>
  );
}
