"use client";

import { useCallback, useEffect, useState } from "react";

import { readDeveloperPortalUrl } from "@/config/site.config";

import styles from "./sandboxWorkspace.module.css";
import { formatTimestamp, sandboxFetch, type UsageSummary, useSandboxContext } from "./useSandboxContext";

type Credential = {
  readonly id: string;
  readonly prefix: string;
  readonly createdAt: string;
  readonly lastUsedAt: string | null;
  readonly expiresAt: string | null;
  readonly revokedAt: string | null;
};

type IssuedCredential = Credential & { readonly token: string };

export function SandboxTestAppsWorkspace() {
  const ctx = useSandboxContext();
  const [credentials, setCredentials] = useState<Credential[]>([]);
  const [usage, setUsage] = useState<UsageSummary | null>(null);
  const [revealedToken, setRevealedToken] = useState("");
  const [copiedToken, setCopiedToken] = useState(false);
  const [confirmRevokeId, setConfirmRevokeId] = useState("");
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const loadData = useCallback(async (signal?: AbortSignal) => {
    if (!ctx.organizationId || !ctx.applicationId) { setCredentials([]); setUsage(null); return; }
    setLoading(true); setError("");
    const qs = new URLSearchParams({ organizationId: ctx.organizationId, applicationId: ctx.applicationId });
    try {
      const [creds, usageData] = await Promise.all([
        sandboxFetch<{ credentials: Credential[] }>(`/api/sandbox/credentials?${qs}`, { signal }),
        sandboxFetch<{ usage: UsageSummary }>(`/api/sandbox/usage?${qs}`, { signal }).catch(() => ({ usage: null })),
      ]);
      if (!signal?.aborted) {
        setCredentials(creds.credentials);
        setUsage(usageData.usage);
      }
    } catch (cause) {
      if (!signal?.aborted) setError(cause instanceof Error ? cause.message : "Could not load sandbox credentials.");
    } finally {
      if (!signal?.aborted) setLoading(false);
    }
  }, [ctx.organizationId, ctx.applicationId]);

  useEffect(() => {
    const controller = new AbortController();
    setRevealedToken("");
    setNotice("");
    void loadData(controller.signal);
    return () => controller.abort();
  }, [loadData]);

  async function mutate(action: "issue" | "rotate" | "revoke", credentialId?: string) {
    if (!ctx.organizationId || !ctx.applicationId || busy) return;
    setBusy(true); setError(""); setNotice(""); setRevealedToken(""); setCopiedToken(false); setConfirmRevokeId("");
    try {
      if (action === "revoke") {
        await sandboxFetch<void>("/api/sandbox/credentials", {
          method: "DELETE",
          body: JSON.stringify({ organizationId: ctx.organizationId, applicationId: ctx.applicationId, credentialId }),
        });
        setNotice("Sandbox credential revoked.");
      } else {
        const endpoint = action === "issue" ? "/api/sandbox/credentials" : "/api/sandbox/credentials/rotate";
        const issued = await sandboxFetch<IssuedCredential>(endpoint, {
          method: "POST",
          body: JSON.stringify({ organizationId: ctx.organizationId, applicationId: ctx.applicationId, ...(credentialId ? { credentialId } : {}), expiresAt: null }),
        });
        setRevealedToken(issued.token);
        setNotice("Copy this sandbox secret now. It is stored as a one-way digest and will not be shown again.");
      }
      await loadData();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Credential operation failed.");
    } finally {
      setBusy(false);
    }
  }

  async function copyToken() {
    try {
      await navigator.clipboard.writeText(revealedToken);
      setCopiedToken(true);
      setNotice("Sandbox token copied to clipboard.");
      window.setTimeout(() => setCopiedToken(false), 2000);
    } catch {
      setError("Clipboard access is unavailable. Select and copy the token manually.");
    }
  }

  return (
    <section className={styles.page} aria-labelledby="test-apps-title">
      <header className={styles.header}>
        <div>
          <p className={styles.eyebrow}>Sandbox <span aria-hidden="true">/</span> Test applications</p>
          <h1 id="test-apps-title">Test applications</h1>
          <p>Provision sandbox-scoped <code>ntsb_test_</code> credentials and inspect monthly sandbox quotas. Production keys are never accepted here.</p>
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

      <div className={styles.callout} role="status">
        <strong>Environment isolation enforced</strong>
        <span>Credentials issued here carry the <code>ntsb_test_</code> prefix and work only against synthetic Sandbox records.</span>
      </div>

      {(ctx.contextError || error) ? <p className={styles.error} role="alert">{ctx.contextError || error}</p> : null}
      {notice ? <p className={styles.notice} role="status">{notice}</p> : null}

      {usage ? (
        <dl className={styles.statsRow} aria-label="Sandbox period usage">
          <div><dt>Messages sent</dt><dd>{usage.messagesSent} / {usage.quotaLimitMessages}</dd></div>
          <div><dt>Remaining quota</dt><dd>{usage.remainingMessages}</dd></div>
          <div><dt>API requests</dt><dd>{usage.requestsCount}</dd></div>
          <div><dt>Scenarios run</dt><dd>{usage.scenariosRun}</dd></div>
        </dl>
      ) : null}

      {revealedToken ? (
        <section className={styles.formGrid} aria-label="Newly issued sandbox secret">
          <strong>Sandbox test token (shown once)</strong>
          <pre className={styles.codeBox}>{revealedToken}</pre>
          <div className={styles.toolbar}>
            <button type="button" className={styles.primaryBtn} onClick={() => void copyToken()}>{copiedToken ? "Copied!" : "Copy token"}</button>
            <button type="button" className={styles.secondaryBtn} onClick={() => setRevealedToken("")}>Hide token</button>
          </div>
        </section>
      ) : null}

      <section className={styles.panel} aria-labelledby="creds-heading">
        <div className={styles.panelHeading}>
          <div>
            <h2 id="creds-heading">Sandbox credentials</h2>
            <p>Active and revoked test credentials for the selected application.</p>
          </div>
          <div className={styles.toolbar}>
            <button type="button" className={styles.primaryBtn} disabled={busy || !ctx.applicationId} onClick={() => void mutate("issue")}>{busy ? "Working…" : "Issue sandbox key"}</button>
            <button type="button" className={styles.secondaryBtn} disabled={loading || !ctx.applicationId} onClick={() => void loadData()}>Refresh</button>
          </div>
        </div>

        {!ctx.loadingOrgs && !ctx.organizations.length ? (
          <p className={styles.empty}>No developer organization found. <a href={readDeveloperPortalUrl()} target="_blank" rel="noopener noreferrer">Open Developer Portal ↗</a> to create an organization and register an application.</p>
        ) : !ctx.loadingOrgs && !ctx.applications.length ? (
          <p className={styles.empty}>No application selected for this organization. <a href={readDeveloperPortalUrl()} target="_blank" rel="noopener noreferrer">Register an application in Developer Portal ↗</a> first.</p>
        ) : credentials.length ? (
          <div className={styles.tableScroll}>
            <table>
              <thead>
                <tr>
                  <th scope="col">Prefix</th>
                  <th scope="col">Created</th>
                  <th scope="col">Last used</th>
                  <th scope="col">Status</th>
                  <th scope="col">Actions</th>
                </tr>
              </thead>
              <tbody>
                {credentials.map((cred) => (
                  <tr key={cred.id}>
                    <td><code>{cred.prefix}…</code></td>
                    <td>{formatTimestamp(cred.createdAt)}</td>
                    <td>{formatTimestamp(cred.lastUsedAt)}</td>
                    <td><span className={`${styles.badge} ${cred.revokedAt ? styles.badgeNeutral : styles.badgeSuccess}`}>{cred.revokedAt ? `Revoked ${formatTimestamp(cred.revokedAt)}` : "Active"}</span></td>
                    <td>
                      <div className={styles.actions}>
                        {confirmRevokeId === cred.id ? (
                          <>
                            <button type="button" className={styles.dangerBtn} disabled={busy} onClick={() => void mutate("revoke", cred.id)}>Confirm revoke</button>
                            <button type="button" className={styles.secondaryBtn} disabled={busy} onClick={() => setConfirmRevokeId("")}>Cancel</button>
                          </>
                        ) : (
                          <>
                            <button type="button" className={styles.secondaryBtn} disabled={busy || Boolean(cred.revokedAt)} onClick={() => void mutate("rotate", cred.id)}>Rotate</button>
                            <button type="button" className={styles.secondaryBtn} disabled={busy || Boolean(cred.revokedAt)} onClick={() => setConfirmRevokeId(cred.id)}>Revoke</button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className={styles.empty}>{loading ? "Loading credentials..." : "No sandbox credentials issued for this application yet."}</p>
        )}
      </section>
    </section>
  );
}
