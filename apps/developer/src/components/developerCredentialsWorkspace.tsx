"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";

import { useDeveloperContext } from "./developerContextProvider";
import styles from "./developerCredentialsWorkspace.module.css";

type Credential = {
  readonly id: string;
  readonly name?: string;
  readonly prefix: string;
  readonly scopes?: string[];
  readonly status?: string;
  readonly createdAt: string;
  readonly lastUsedAt: string | null;
  readonly expiresAt?: string | null;
  readonly revokedAt?: string | null;
};

type CredentialResponse = Credential & { readonly token?: string; readonly secret?: string };

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(path, {
    ...init,
    credentials: "same-origin",
    cache: "no-store",
    headers: { accept: "application/json", ...(init?.body ? { "content-type": "application/json" } : {}), ...init?.headers },
  });
  if (!response.ok) {
    const payload = (await response.json().catch(() => null)) as { message?: string } | null;
    throw new Error(payload?.message ?? "The credential service could not complete this request.");
  }
  if (response.status === 204) return undefined as T;
  return response.json() as Promise<T>;
}

function formatDate(value: string | null | undefined): string {
  if (!value) return "Never";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "—" : new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" }).format(date);
}

const availableProductionScopes = ["messages:send", "conversations:read"] as const;

export function DeveloperCredentialsWorkspace() {
  const { environment, organizations, organizationId, setOrganizationId, applications, applicationId, setApplicationId, loading } = useDeveloperContext();
  const [credentials, setCredentials] = useState<Credential[]>([]);
  const [expiresAt, setExpiresAt] = useState("");
  const [credName, setCredName] = useState("");
  const [selectedScopes, setSelectedScopes] = useState<string[]>(["messages:send", "conversations:read"]);
  const [revealedToken, setRevealedToken] = useState("");
  const [copiedSecret, setCopiedSecret] = useState(false);
  const [confirmRevokeId, setConfirmRevokeId] = useState("");
  const [confirmRotateId, setConfirmRotateId] = useState("");
  const [busy, setBusy] = useState(false);
  const [loadingCredentials, setLoadingCredentials] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const loadCredentials = useCallback(async (signal?: AbortSignal) => {
    if (!organizationId || !applicationId) {
      setCredentials([]);
      setLoadingCredentials(false);
      return;
    }
    setLoadingCredentials(true);
    setError("");
    try {
      if (environment === "production") {
        const result = await request<{ credentials: Credential[] }>(
          `/api/developer/organizations/${encodeURIComponent(organizationId)}/applications/${encodeURIComponent(applicationId)}/credentials`,
          { signal },
        );
        if (!signal?.aborted) setCredentials(result.credentials ?? []);
      } else {
        const query = new URLSearchParams({ organizationId, applicationId });
        const result = await request<{ credentials: Credential[] }>(`/api/developer/credentials?${query}`, { signal });
        if (!signal?.aborted) setCredentials(result.credentials ?? []);
      }
    } catch (cause) {
      if (!signal?.aborted) setError(cause instanceof Error ? cause.message : "Could not load credentials for this application.");
    } finally {
      if (!signal?.aborted) setLoadingCredentials(false);
    }
  }, [applicationId, environment, organizationId]);

  useEffect(() => {
    const controller = new AbortController();
    setRevealedToken("");
    setNotice("");
    void loadCredentials(controller.signal);
    return () => controller.abort();
  }, [loadCredentials]);

  async function run(action: "issue" | "rotate" | "revoke", credentialId?: string) {
    if (!organizationId || !applicationId || busy) return;
    setBusy(true);
    setError("");
    setNotice("");
    setRevealedToken("");
    setCopiedSecret(false);
    setConfirmRevokeId("");
    setConfirmRotateId("");
    try {
      if (environment === "production") {
        const base = `/api/developer/organizations/${encodeURIComponent(organizationId)}/applications/${encodeURIComponent(applicationId)}/credentials`;
        if (action === "revoke" && credentialId) {
          await request<void>(`${base}/${encodeURIComponent(credentialId)}`, { method: "DELETE" });
          setNotice("Production credential revoked.");
        } else if (action === "rotate" && credentialId) {
          const result = await request<{ credential: Credential; secret: string }>(`${base}/${encodeURIComponent(credentialId)}/rotate`, { method: "POST" });
          setRevealedToken(result.secret);
          setNotice("Production credential rotated. Copy the new secret now; it will not be shown again.");
        } else if (action === "issue") {
          const result = await request<{ credential: Credential; secret: string }>(base, {
            method: "POST",
            body: JSON.stringify({ name: credName.trim() || "Production key", scopes: selectedScopes }),
          });
          setRevealedToken(result.secret);
          setCredName("");
          setNotice("Copy this production secret now. It will not be shown again.");
        }
        await loadCredentials();
        return;
      }

      const payload = { organizationId, applicationId, ...(credentialId ? { credentialId } : {}), expiresAt: expiresAt ? new Date(expiresAt).toISOString() : null };
      if (action === "revoke") {
        await request<void>("/api/developer/credentials", { method: "DELETE", body: JSON.stringify(payload) });
        setNotice("Sandbox credential revoked.");
      } else {
        const issued = action === "issue"
          ? await request<CredentialResponse>("/api/developer/credentials", { method: "POST", body: JSON.stringify(payload) })
          : await request<CredentialResponse>("/api/developer/credentials/rotate", { method: "POST", body: JSON.stringify(payload) });
        setRevealedToken(issued.token ?? issued.secret ?? "");
        setNotice("Copy this sandbox secret now. It will not be shown again.");
      }
      await loadCredentials();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Credential management failed. Try again.");
    } finally {
      setBusy(false);
    }
  }

  async function copySecret() {
    try {
      await navigator.clipboard.writeText(revealedToken);
      setCopiedSecret(true);
      setNotice("Secret copied. Store it securely; it cannot be retrieved later.");
      window.setTimeout(() => setCopiedSecret(false), 2000);
    } catch {
      setError("Clipboard access is unavailable. Select and copy the secret manually.");
    }
  }

  const selectedApplication = applications.find((item) => item.id === applicationId);
  const activeCredentials = credentials.filter((item) => !item.revokedAt && item.status !== "revoked");
  const isProdBlocked = environment === "production" && selectedApplication && selectedApplication.status !== "approved";

  return (
    <section className={styles.page} aria-labelledby="credentials-title">
      <header className={styles.header}>
        <div>
          <p className={styles.eyebrow}>Developer workspace / Build · {environment === "production" ? "Production" : "Sandbox"}</p>
          <h1 id="credentials-title">API credentials</h1>
          <p>Issue and manage {environment === "production" ? "live ntlive_ production keys" : "isolated ntsb_test_ sandbox keys"} for authorized applications.</p>
        </div>
        <div className={styles.selectors}>
          <label>Organization<select aria-label="Organization" value={organizationId} disabled={loading || loadingCredentials || organizations.length === 0} onChange={(event) => setOrganizationId(event.target.value)}>{organizations.length ? organizations.map((item) => <option key={item.id} value={item.id}>{item.name}</option>) : <option value="">No organizations</option>}</select></label>
          <label>Application<select aria-label="Application" value={applicationId} disabled={loadingCredentials || !applications.length} onChange={(event) => setApplicationId(event.target.value)}>{applications.length ? applications.map((item) => <option key={item.id} value={item.id}>{item.name} ({item.status})</option>) : <option value="">No applications</option>}</select></label>
        </div>
      </header>

      <div className={styles.callout} role="note">
        <strong>{environment === "production" ? "Production keys require application approval" : "Sandbox credentials only"}</strong>
        <span>
          {environment === "production"
            ? "Production ntlive_ keys authorize /api/v1/business/* requests within your organization quota. Sandbox ntsb_test_ keys remain isolated."
            : "Sandbox credentials cannot access production or real customers. Switch to Production in the header when your application is approved."}
        </span>
      </div>
      {error ? <p className={styles.error} role="alert">{error}</p> : null}
      {notice ? <p className={styles.notice} role="status">{notice}</p> : null}

      {revealedToken ? (
        <section className={styles.secretPanel} aria-labelledby="secret-title">
          <h2 id="secret-title">New secret — shown once</h2>
          <p>Copy this value now and store it in your integration’s secret manager. Nantty stores only a one-way SHA-256 digest.</p>
          <div className={styles.secretValue}><code>{revealedToken}</code><button type="button" onClick={() => void copySecret()}>{copiedSecret ? "Copied!" : "Copy secret"}</button></div>
          <button className={styles.secondaryButton} type="button" onClick={() => setRevealedToken("")}>Hide secret</button>
        </section>
      ) : null}

      <section className={styles.records} aria-labelledby="credential-list-title">
        <div className={styles.recordsHeading}>
          <div><h2 id="credential-list-title">{environment === "production" ? "Production credentials" : "Sandbox credentials"}</h2><p>Secrets are never returned by list operations.</p></div>
          <div className={styles.listTools}><span>{activeCredentials.length} active</span><button type="button" disabled={loadingCredentials || !applicationId} onClick={() => void loadCredentials()}>{loadingCredentials ? "Refreshing…" : "Refresh"}</button></div>
        </div>
        {environment === "production" ? (
          <div className={styles.issueControls}>
            <label>Key name<input maxLength={80} value={credName} onChange={(e) => setCredName(e.target.value)} placeholder="Production backend key" /></label>
            <div style={{ display: "flex", gap: "12px", alignItems: "center", flexWrap: "wrap" }}>
              {availableProductionScopes.map((scope) => (
                <label key={scope} style={{ display: "inline-flex", gap: "6px", alignItems: "center", fontSize: "var(--fs-12)" }}>
                  <input type="checkbox" checked={selectedScopes.includes(scope)} onChange={() => setSelectedScopes((curr) => curr.includes(scope) ? curr.filter((s) => s !== scope) : [...curr, scope])} />
                  <code>{scope}</code>
                </label>
              ))}
            </div>
            <button type="button" disabled={busy || loadingCredentials || Boolean(isProdBlocked) || !selectedApplication || selectedScopes.length === 0} onClick={() => void run("issue")}>
              {busy ? "Working…" : "Create production credential"}
            </button>
          </div>
        ) : (
          <div className={styles.issueControls}>
            <label>Optional expiration<input type="datetime-local" value={expiresAt} onChange={(event) => setExpiresAt(event.target.value)} /></label>
            <button type="button" disabled={busy || loadingCredentials || Boolean(error) || !organizationId || !selectedApplication} onClick={() => void run("issue")}>{busy ? "Working…" : "Create sandbox credential"}</button>
          </div>
        )}
        {isProdBlocked ? <p className={styles.empty}>Application status is <strong>{selectedApplication.status}</strong>. An administrator must approve this application before production <code>ntlive_</code> keys can be issued.</p> : null}
        {loading ? <p className={styles.empty}>Loading organizations…</p> : loadingCredentials ? <p className={styles.empty}>Loading credentials…</p> : !organizations.length ? <p className={styles.empty}>Create or join a developer organization before issuing credentials. <Link href="/organization">Manage organizations</Link></p> : !applications.length ? <p className={styles.empty}>Register an application first. <Link href="/applications">Register application</Link></p> : !credentials.length ? <p className={styles.empty}>No {environment} credentials for this application yet.</p> : (
          <div className={styles.tableScroll}>
            <table>
              <thead><tr><th>Credential</th><th>Scopes</th><th>Created</th><th>Last used</th><th>Status</th><th><span className={styles.srOnly}>Actions</span></th></tr></thead>
              <tbody>
                {credentials.map((item) => {
                  const isRevoked = Boolean(item.revokedAt) || item.status === "revoked";
                  return (
                    <tr key={item.id}>
                      <td>{item.name ? <><strong>{item.name}</strong><br /></> : null}<code>{item.prefix}…</code></td>
                      <td>{item.scopes?.length ? item.scopes.join(", ") : "sandbox:all"}</td>
                      <td>{formatDate(item.createdAt)}</td>
                      <td>{formatDate(item.lastUsedAt)}</td>
                      <td><span className={`${styles.badge} ${isRevoked ? styles.badgeNeutral : styles.badgeSuccess}`}>{isRevoked ? "Revoked" : "Active"}</span></td>
                      <td>
                        <div className={styles.actions}>
                          {confirmRotateId === item.id ? (
                            <><span role="status">The existing key stops working immediately.</span><button type="button" disabled={busy} onClick={() => void run("rotate", item.id)}>Confirm rotation</button><button type="button" className={styles.secondaryButton} disabled={busy} onClick={() => setConfirmRotateId("")}>Cancel</button></>
                          ) : confirmRevokeId === item.id ? (
                            <><button type="button" className={styles.dangerButton} disabled={busy} onClick={() => void run("revoke", item.id)}>Confirm revoke</button><button type="button" className={styles.secondaryButton} disabled={busy} onClick={() => setConfirmRevokeId("")}>Cancel</button></>
                          ) : (
                            <>
                              <button type="button" disabled={busy || isRevoked || Boolean(isProdBlocked)} onClick={() => setConfirmRotateId(item.id)}>Rotate</button>
                              <button type="button" className={styles.secondaryButton} disabled={busy || isRevoked} onClick={() => setConfirmRevokeId(item.id)}>Revoke</button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </section>
  );
}
