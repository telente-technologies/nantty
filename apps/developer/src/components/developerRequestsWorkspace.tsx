"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";

import { useDeveloperContext } from "./developerContextProvider";
import styles from "./developerCredentialsWorkspace.module.css";

type RequestRecord = {
  readonly id?: string;
  readonly requestId?: string;
  readonly method: string;
  readonly path: string;
  readonly statusCode: number;
  readonly latencyMs?: number;
  readonly createdAt: string;
};

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(path, { ...init, credentials: "same-origin", cache: "no-store", headers: { accept: "application/json", ...init?.headers } });
  if (!response.ok) {
    const payload = (await response.json().catch(() => null)) as { message?: string; error?: { message?: string } } | null;
    throw new Error(payload?.error?.message ?? payload?.message ?? "Request logs could not be loaded.");
  }
  return response.json() as Promise<T>;
}

function formatDate(value: string): string {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "—" : new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "medium" }).format(date);
}

export function DeveloperRequestsWorkspace() {
  const { environment, organizations, organizationId, setOrganizationId, applications, applicationId, setApplicationId, loading } = useDeveloperContext();
  const [requests, setRequests] = useState<RequestRecord[]>([]);
  const [methodFilter, setMethodFilter] = useState("ALL");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [queryFilter, setQueryFilter] = useState("");
  const [loadingRows, setLoadingRows] = useState(false);
  const [error, setError] = useState("");

  const loadRequests = useCallback(async (signal?: AbortSignal) => {
    if (!organizationId || !applicationId) {
      setRequests([]);
      return;
    }
    setLoadingRows(true);
    setError("");
    try {
      const endpoint = environment === "production"
        ? `/api/developer/organizations/${encodeURIComponent(organizationId)}/applications/${encodeURIComponent(applicationId)}/requests`
        : `/api/developer/requests?${new URLSearchParams({ organizationId, applicationId })}`;
      const data = await request<{ requests: RequestRecord[] }>(endpoint, { signal });
      if (!signal?.aborted) setRequests(data.requests ?? []);
    } catch (cause) {
      if (!signal?.aborted) setError(cause instanceof Error ? cause.message : "Could not load request logs.");
    } finally {
      if (!signal?.aborted) setLoadingRows(false);
    }
  }, [applicationId, environment, organizationId]);

  useEffect(() => {
    const controller = new AbortController();
    void loadRequests(controller.signal);
    return () => controller.abort();
  }, [loadRequests]);

  const normalizedQuery = queryFilter.trim().toLowerCase();
  const filtered = requests.filter((row) => {
    const rowId = (row.requestId ?? row.id ?? "").toLowerCase();
    if (methodFilter !== "ALL" && row.method !== methodFilter) return false;
    if (statusFilter === "2XX" && (row.statusCode < 200 || row.statusCode >= 300)) return false;
    if (statusFilter === "4XX" && (row.statusCode < 400 || row.statusCode >= 500)) return false;
    if (statusFilter === "5XX" && row.statusCode < 500) return false;
    if (normalizedQuery && !row.path.toLowerCase().includes(normalizedQuery) && !rowId.includes(normalizedQuery)) return false;
    return true;
  });

  return (
    <section className={styles.page} aria-labelledby="requests-title">
      <header className={styles.header}>
        <div>
          <p className={styles.eyebrow}>Developer workspace / Operate · {environment === "production" ? "Production" : "Sandbox"}</p>
          <h1 id="requests-title">API request logs</h1>
          <p>Inspect redacted {environment === "production" ? "production Business Messaging" : "isolated Sandbox"} API request outcomes.</p>
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
        <strong>{environment === "production" ? "Production request ledger" : "Sandbox traffic only"}</strong>
        <span>Authorization headers, API secrets, and personal message bodies are never stored in request logs.</span>
      </div>

      {error ? <p className={styles.error} role="alert">{error}</p> : null}

      <section className={styles.records} aria-label="Request log records">
        <div className={styles.recordsHeading}>
          <div>
            <h2>Recent {environment} requests</h2>
            <p>Newest redacted records for the selected application.</p>
          </div>
          <div className={styles.listTools}>
            <input type="search" aria-label="Filter by path or request ID" placeholder="Search path or ID…" value={queryFilter} onChange={(e) => setQueryFilter(e.target.value)} />
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

        {loading ? <p className={styles.empty}>Loading organizations...</p> : !organizations.length ? (
          <p className={styles.empty}>Create or join a developer organization to inspect request logs. <Link href="/organization">Manage organizations</Link></p>
        ) : !applications.length ? (
          <p className={styles.empty}>Register an application first. <Link href="/applications">Register application</Link></p>
        ) : filtered.length ? (
          <div className={styles.tableScroll}>
            <table>
              <thead>
                <tr>
                  <th scope="col">Request ID</th>
                  <th scope="col">Method</th>
                  <th scope="col">Path</th>
                  <th scope="col">Status</th>
                  {environment === "production" ? <th scope="col">Latency</th> : null}
                  <th scope="col">Recorded</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((row) => {
                  const id = row.requestId ?? row.id ?? "";
                  const statusTone = row.statusCode >= 500 ? styles.badgeDanger : row.statusCode >= 400 ? styles.badgeWarn : row.statusCode >= 200 && row.statusCode < 300 ? styles.badgeSuccess : styles.badgeNeutral;
                  return (
                    <tr key={id}>
                      <td><code>{id}</code></td>
                      <td><span className={`${styles.badge} ${styles.badgeNeutral}`}><code>{row.method}</code></span></td>
                      <td><code>{row.path}</code></td>
                      <td><span className={`${styles.badge} ${statusTone}`}>{row.statusCode}</span></td>
                      {environment === "production" ? <td>{row.latencyMs ?? 0} ms</td> : null}
                      <td>{formatDate(row.createdAt)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <p className={styles.empty}>{loadingRows ? "Loading request records..." : `No ${environment} request records match the selected filters.`}</p>
        )}
      </section>
    </section>
  );
}
