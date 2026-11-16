"use client";

import { useEffect, useState } from "react";

import styles from "./developerCredentialsWorkspace.module.css";

type Organization = { readonly id: string; readonly name: string };
type Application = { readonly id: string; readonly name: string; readonly status: string };
type Credential = { readonly id: string; readonly prefix: string; readonly createdAt: string; readonly lastUsedAt: string | null; readonly expiresAt: string | null; readonly revokedAt: string | null };
type CredentialResponse = { readonly id: string; readonly prefix: string; readonly createdAt: string; readonly lastUsedAt: string | null; readonly expiresAt: string | null; readonly revokedAt: string | null; readonly environment: "sandbox"; readonly token: string };

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(path, {
    ...init,
    credentials: "same-origin",
    cache: "no-store",
    headers: { accept: "application/json", ...(init?.body ? { "content-type": "application/json" } : {}), ...init?.headers },
  });
  if (!response.ok) {
    const payload = await response.json().catch(() => null) as { message?: string } | null;
    throw new Error(payload?.message ?? "The credential service could not complete this request.");
  }
  if (response.status === 204) return undefined as T;
  return response.json() as Promise<T>;
}

function formatDate(value: string | null): string {
  if (!value) return "Never";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "—" : new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" }).format(date);
}

export function DeveloperCredentialsWorkspace() {
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [organizationId, setOrganizationId] = useState("");
  const [applications, setApplications] = useState<Application[]>([]);
  const [applicationId, setApplicationId] = useState("");
  const [credentials, setCredentials] = useState<Credential[]>([]);
  const [expiresAt, setExpiresAt] = useState("");
  const [revealedToken, setRevealedToken] = useState("");
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadingCredentials, setLoadingCredentials] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

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
    setApplications([]); setApplicationId(""); setCredentials([]); setRevealedToken(""); setError("");
    void request<{ applications: Application[] }>(`/api/developer/organizations/${encodeURIComponent(organizationId)}/applications`, { signal: controller.signal })
      .then(({ applications: items }) => { if (!controller.signal.aborted) { setApplications(items); setApplicationId(items[0]?.id ?? ""); } })
      .catch((cause: unknown) => { if (!controller.signal.aborted) setError(cause instanceof Error ? cause.message : "Could not load applications."); });
    return () => controller.abort();
  }, [organizationId]);

  useEffect(() => {
    if (!organizationId || !applicationId) { setCredentials([]); setLoadingCredentials(false); return; }
    const controller = new AbortController();
    setCredentials([]); setRevealedToken(""); setError(""); setNotice(""); setLoadingCredentials(true);
    const query = new URLSearchParams({ organizationId, applicationId });
    void request<{ credentials: Credential[] }>(`/api/developer/credentials?${query}`, { signal: controller.signal })
      .then(({ credentials: items }) => { if (!controller.signal.aborted) setCredentials(items); })
      .catch((cause: unknown) => { if (!controller.signal.aborted) setError(cause instanceof Error ? cause.message : "Could not load credentials for this application."); })
      .finally(() => { if (!controller.signal.aborted) setLoadingCredentials(false); });
    return () => controller.abort();
  }, [organizationId, applicationId]);

  async function reloadCredentials() {
    if (!organizationId || !applicationId || loadingCredentials) return;
    setLoadingCredentials(true); setError("");
    const query = new URLSearchParams({ organizationId, applicationId });
    try {
      const result = await request<{ credentials: Credential[] }>(`/api/developer/credentials?${query}`);
      setCredentials(result.credentials);
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Could not load credentials for this application."); }
    finally { setLoadingCredentials(false); }
  }

  function payload(credentialId?: string) {
    return { organizationId, applicationId, ...(credentialId ? { credentialId } : {}), expiresAt: expiresAt ? new Date(expiresAt).toISOString() : null };
  }

  async function run(action: "issue" | "rotate" | "revoke", credentialId?: string) {
    if (!organizationId || !applicationId || busy) return;
    if (action === "revoke" && !window.confirm("Revoke this sandbox credential? Requests using it will stop working.")) return;
    setBusy(true); setError(""); setNotice(""); setRevealedToken("");
    try {
      if (action === "revoke") {
        await request<void>("/api/developer/credentials", { method: "DELETE", body: JSON.stringify(payload(credentialId)) });
        setCredentials((current) => current.map((item) => item.id === credentialId ? { ...item, revokedAt: new Date().toISOString() } : item));
        setNotice("Sandbox credential revoked.");
      } else {
        const issued = action === "issue"
          ? await request<CredentialResponse>("/api/developer/credentials", { method: "POST", body: JSON.stringify(payload()) })
          : await request<CredentialResponse>("/api/developer/credentials/rotate", { method: "POST", body: JSON.stringify(payload(credentialId)) });
        setRevealedToken(issued.token);
        setCredentials((current) => action === "rotate" ? current.map((item) => item.id === credentialId ? { ...item, revokedAt: new Date().toISOString() } : item).concat(issued) : [issued, ...current]);
        setNotice("Copy this sandbox secret now. It will not be shown again.");
      }
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Credential management failed. Try again."); }
    finally { setBusy(false); }
  }

  async function copySecret() {
    try { await navigator.clipboard.writeText(revealedToken); setNotice("Sandbox secret copied. Store it securely; it cannot be retrieved later."); }
    catch { setError("Clipboard access is unavailable. Select and copy the secret manually."); }
  }

  const selectedApplication = applications.find((item) => item.id === applicationId);
  const activeCredentials = credentials.filter((item) => !item.revokedAt);

  return (
    <section className={styles.page} aria-labelledby="credentials-title">
      <header className={styles.header}>
        <div><p className={styles.eyebrow}>Developer workspace / Build</p><h1 id="credentials-title">API credentials</h1><p>Issue and manage test credentials for authorized applications.</p></div>
        <div className={styles.selectors}>
          <label>Organization<select aria-label="Organization" value={organizationId} disabled={loading || loadingCredentials || organizations.length === 0} onChange={(event) => setOrganizationId(event.target.value)}>{organizations.length ? organizations.map((item) => <option key={item.id} value={item.id}>{item.name}</option>) : <option value="">No organizations</option>}</select></label>
          <label>Application<select aria-label="Application" value={applicationId} disabled={loadingCredentials || !applications.length} onChange={(event) => setApplicationId(event.target.value)}>{applications.length ? applications.map((item) => <option key={item.id} value={item.id}>{item.name}</option>) : <option value="">No applications</option>}</select></label>
        </div>
      </header>

      <div className={styles.callout} role="note"><strong>Sandbox credentials only</strong><span>These credentials cannot access production or real customers. Production credentials are not available through this screen.</span></div>
      {error ? <p className={styles.error} role="alert">{error}</p> : null}
      {notice ? <p className={styles.notice} role="status">{notice}</p> : null}

      {revealedToken ? <section className={styles.secretPanel} aria-labelledby="secret-title">
        <h2 id="secret-title">New secret — shown once</h2>
        <p>Copy this value now and store it in your integration’s secret manager. Nantty stores only a one-way digest.</p>
        <div className={styles.secretValue}><code>{revealedToken}</code><button type="button" onClick={() => void copySecret()}>Copy secret</button></div>
        <button className={styles.secondaryButton} type="button" onClick={() => setRevealedToken("")}>Hide secret</button>
      </section> : null}

      <section className={styles.records} aria-labelledby="credential-list-title">
        <div className={styles.recordsHeading}><div><h2 id="credential-list-title">Sandbox credentials</h2><p>Secrets are never returned by the list endpoint.</p></div><div className={styles.listTools}><span>{activeCredentials.length} active</span><button type="button" disabled={loadingCredentials || !applicationId} onClick={() => void reloadCredentials()}>{loadingCredentials ? "Refreshing…" : "Refresh"}</button></div></div>
        <div className={styles.issueControls}>
          <label>Optional expiration<input type="datetime-local" value={expiresAt} onChange={(event) => setExpiresAt(event.target.value)} /></label>
          <button type="button" disabled={busy || loadingCredentials || Boolean(error) || !organizationId || !selectedApplication} onClick={() => void run("issue")}>{busy ? "Working…" : "Create sandbox credential"}</button>
        </div>
        {loading ? <p className={styles.empty}>Loading organizations…</p> : loadingCredentials ? <p className={styles.empty}>Loading credentials…</p> : !organizations.length ? <p className={styles.empty}>Create or join a developer organization before issuing a test credential.</p> : !applications.length ? <p className={styles.empty}>Register an application first. Credentials are scoped to one application.</p> : error ? null : !credentials.length ? <p className={styles.empty}>No sandbox credentials for this application yet.</p> : <div className={styles.tableScroll}><table><thead><tr><th>Credential</th><th>Created</th><th>Last used</th><th>Expires</th><th>Status</th><th><span className={styles.srOnly}>Actions</span></th></tr></thead><tbody>{credentials.map((item) => <tr key={item.id}><td><code>{item.prefix}…</code></td><td>{formatDate(item.createdAt)}</td><td>{formatDate(item.lastUsedAt)}</td><td>{formatDate(item.expiresAt)}</td><td>{item.revokedAt ? "Revoked" : "Active"}</td><td><div className={styles.actions}><button type="button" disabled={busy || Boolean(error) || Boolean(item.revokedAt)} onClick={() => void run("rotate", item.id)}>Rotate</button><button type="button" className={styles.secondaryButton} disabled={busy || Boolean(error) || Boolean(item.revokedAt)} onClick={() => void run("revoke", item.id)}>Revoke</button></div></td></tr>)}</tbody></table></div>}
      </section>
    </section>
  );
}
