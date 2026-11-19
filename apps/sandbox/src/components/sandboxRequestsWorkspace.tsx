"use client";

import { useCallback, useEffect, useState } from "react";

import { readDeveloperPortalUrl } from "@/config/site.config";

import styles from "./sandboxWorkspace.module.css";
import { formatTimestamp, sandboxFetch, useSandboxContext } from "./useSandboxContext";

type RequestRow = { readonly requestId: string; readonly method: string; readonly path: string; readonly statusCode: number; readonly createdAt: string };

export function SandboxRequestsWorkspace() {
  const ctx = useSandboxContext();
  const [requests, setRequests] = useState<RequestRow[]>([]);
  const [methodFilter, setMethodFilter] = useState("ALL");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [queryFilter, setQueryFilter] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const loadData = useCallback(async (signal?: AbortSignal) => {
    if (!ctx.organizationId || !ctx.applicationId) { setRequests([]); return; }
    setLoading(true); setError("");
    const qs = new URLSearchParams({ organizationId: ctx.organizationId, applicationId: ctx.applicationId });
    try {
      const data = await sandboxFetch<{ requests: RequestRow[] }>(`/api/sandbox/requests?${qs}`, { signal });
      if (!signal?.aborted) setRequests(data.requests);
    } catch (cause) {
      if (!signal?.aborted) setError(cause instanceof Error ? cause.message : "Could not load request logs.");
    } finally {
      if (!signal?.aborted) setLoading(false);
    }
  }, [ctx.organizationId, ctx.applicationId]);

  useEffect(() => {
    const controller = new AbortController();
    void loadData(controller.signal);
    return () => controller.abort();
  }, [loadData]);

  const normalizedQuery = queryFilter.trim().toLowerCase();
  const filtered = requests.filter((r) => {
    if (methodFilter !== "ALL" && r.method !== methodFilter) return false;
    if (statusFilter === "2XX" && (r.statusCode < 200 || r.statusCode >= 300)) return false;
    if (statusFilter === "4XX" && (r.statusCode < 400 || r.statusCode >= 500)) return false;
    if (statusFilter === "5XX" && r.statusCode < 500) return false;
    if (normalizedQuery && !r.path.toLowerCase().includes(normalizedQuery) && !r.requestId.toLowerCase().includes(normalizedQuery)) return false;
    return true;
  });

  return (
    <section className={styles.page} aria-labelledby="sandbox-requests-title">
      <header className={styles.header}>
        <div>
          <p className={styles.eyebrow}>Sandbox <span aria-hidden="true">/</span> Request log</p>
          <h1 id="sandbox-requests-title">Request log</h1>
          <p>Inspect gateway-captured, redacted Sandbox API requests correlated by request ID.</p>
        </div>
        <div className={styles.selectors}>
          <label>
            Organization
            <select value={ctx.organizationId} onChange={(e) => ctx.setOrganizationId(e.target.value)} disabled={ctx.loadingOrgs || !ctx.organizations.length}>
              {ctx.organizations.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}
            </select>
          </label>
          <label>
            Application
            <select value={ctx.applicationId} onChange={(e) => ctx.setApplicationId(e.target.value)} disabled={!ctx.applications.length}>
              {ctx.applications.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
            </select>
          </label>
        </div>
      </header>

      {(ctx.contextError || error) ? <p className={styles.error} role="alert">{ctx.contextError || error}</p> : null}

      <section className={styles.panel} aria-label="Sandbox request log table">
        <div className={styles.panelHeading}>
          <div><h2>Redacted requests</h2><p>Tokens and request bodies are stripped at the Sandbox gateway.</p></div>
          <div className={styles.toolbar}>
            <input
              type="search"
              aria-label="Filter by endpoint or request ID"
              placeholder="Search endpoint or request ID…"
              value={queryFilter}
              onChange={(e) => setQueryFilter(e.target.value)}
            />
            <select aria-label="Method filter" value={methodFilter} onChange={(e) => setMethodFilter(e.target.value)}>
              <option value="ALL">All methods</option>
              <option value="GET">GET</option>
              <option value="POST">POST</option>
              <option value="PATCH">PATCH</option>
              <option value="DELETE">DELETE</option>
            </select>
            <select aria-label="Status filter" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
              <option value="ALL">All statuses</option>
              <option value="2XX">2xx</option>
              <option value="4XX">4xx</option>
              <option value="5XX">5xx</option>
            </select>
            <button type="button" className={styles.secondaryBtn} disabled={loading || !ctx.applicationId} onClick={() => void loadData()}>Refresh</button>
          </div>
        </div>

        {!ctx.loadingOrgs && !ctx.organizations.length ? (
          <p className={styles.empty}>No developer organization found. <a href={readDeveloperPortalUrl()} target="_blank" rel="noopener noreferrer">Open Developer Portal ↗</a> to create one.</p>
        ) : !ctx.loadingOrgs && !ctx.applications.length ? (
          <p className={styles.empty}>No application selected. <a href={readDeveloperPortalUrl()} target="_blank" rel="noopener noreferrer">Register an application in Developer Portal ↗</a> first.</p>
        ) : filtered.length ? (
          <div className={styles.tableScroll}>
            <table>
              <thead><tr><th scope="col">Request ID</th><th scope="col">Method</th><th scope="col">Endpoint</th><th scope="col">Status</th><th scope="col">Recorded</th></tr></thead>
              <tbody>
                {filtered.map((row) => {
                  const statusTone = row.statusCode >= 500
                    ? styles.badgeDanger
                    : row.statusCode >= 400
                      ? styles.badgeWarn
                      : row.statusCode >= 200 && row.statusCode < 300
                        ? styles.badgeSuccess
                        : styles.badgeNeutral;
                  return (
                    <tr key={row.requestId}>
                      <td><code>{row.requestId}</code></td>
                      <td><span className={`${styles.badge} ${styles.badgeNeutral}`}><code>{row.method}</code></span></td>
                      <td><code>{row.path}</code></td>
                      <td><span className={`${styles.badge} ${statusTone}`}>{row.statusCode}</span></td>
                      <td>{formatTimestamp(row.createdAt)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <p className={styles.empty}>{loading ? "Loading request log..." : "No sandbox API requests recorded for these filters."}</p>
        )}
      </section>
    </section>
  );
}
